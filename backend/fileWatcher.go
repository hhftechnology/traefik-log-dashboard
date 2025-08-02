package main

import (
	"bufio"
	"io"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

type FileWatcher struct {
	filePath      string
	file          *os.File
	reader        *bufio.Reader
	lastPos       int64
	lastSize      int64
	parser        *LogParser
	watcher       *fsnotify.Watcher
	stopChan      chan struct{}
	running       bool
	mu            sync.Mutex
	checkInterval time.Duration
	isInitialLoad bool
	fileID        string  // Unique identifier for this file
}

func NewFileWatcher(filePath string, parser *LogParser) (*FileWatcher, error) {
	fw := &FileWatcher{
		filePath:      filePath,
		parser:        parser,
		stopChan:      make(chan struct{}),
		checkInterval: 1 * time.Second,
		isInitialLoad: true,
	}

	// Create fsnotify watcher
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}
	fw.watcher = watcher

	// Watch the directory for file creation/deletion
	dir := filepath.Dir(filePath)
	if err := watcher.Add(dir); err != nil {
		watcher.Close()
		return nil, err
	}

	return fw, nil
}

func (fw *FileWatcher) Start() error {
	fw.mu.Lock()
	if fw.running {
		fw.mu.Unlock()
		return nil
	}
	fw.running = true
	fw.mu.Unlock()

	// Open file and seek to end
	if err := fw.openFile(); err != nil {
		log.Printf("Error opening file %s: %v", fw.filePath, err)
	}

	// Start watching
	go fw.watchLoop()
	go fw.pollLoop()

	return nil
}

func (fw *FileWatcher) Stop() {
	fw.mu.Lock()
	if !fw.running {
		fw.mu.Unlock()
		return
	}
	fw.running = false
	fw.mu.Unlock()

	close(fw.stopChan)
	fw.watcher.Close()
	
	if fw.file != nil {
		fw.file.Close()
	}
}

func (fw *FileWatcher) openFile() error {
	fw.mu.Lock()
	defer fw.mu.Unlock()

	// Close existing file if open
	if fw.file != nil {
		fw.file.Close()
	}

	// Check if file exists
	info, err := os.Stat(fw.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			log.Printf("File %s does not exist yet", fw.filePath)
			fw.file = nil
			fw.lastPos = 0
			fw.lastSize = 0
			return nil
		}
		return err
	}

	// Open file
	file, err := os.Open(fw.filePath)
	if err != nil {
		return err
	}

	fw.file = file
	fw.reader = bufio.NewReader(file)
	fw.lastSize = info.Size()

	// If this is a new file or the file was truncated, start from beginning
	if fw.lastPos > info.Size() {
		log.Printf("File %s was truncated, starting from beginning", fw.filePath)
		fw.lastPos = 0
	} else if fw.isInitialLoad {
		// Initial load is handled by loadHistoricalLogs in LogParser
		// So we seek to end to only watch for new entries
		fw.lastPos = info.Size()
		file.Seek(fw.lastPos, io.SeekStart)
		fw.isInitialLoad = false
	} else if fw.lastPos == 0 {
		// File was recreated, start from beginning
		fw.lastPos = 0
	} else {
		// Resume from last position
		file.Seek(fw.lastPos, io.SeekStart)
	}

	// Try to watch the file directly
	fw.watcher.Add(fw.filePath)

	return nil
}

func (fw *FileWatcher) readNewLines() {
	fw.mu.Lock()
	if fw.file == nil {
		fw.mu.Unlock()
		return
	}
	reader := fw.reader
	fw.mu.Unlock()

	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			if err != io.EOF {
				log.Printf("Error reading from %s: %v", fw.filePath, err)
			}
			break
		}

		// Update position
		fw.mu.Lock()
		pos, _ := fw.file.Seek(0, io.SeekCurrent)
		fw.lastPos = pos
		fw.mu.Unlock()

		// Parse the line
		if line != "" && line != "\n" {
			fw.parser.parseLine(line, true)
		}
	}
}

func (fw *FileWatcher) checkFile() {
	info, err := os.Stat(fw.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			// File was deleted
			fw.mu.Lock()
			if fw.file != nil {
				log.Printf("File %s was deleted", fw.filePath)
				fw.file.Close()
				fw.file = nil
				fw.lastPos = 0
				fw.lastSize = 0
			}
			fw.mu.Unlock()
		}
		return
	}

	fw.mu.Lock()
	currentSize := info.Size()
	
	// File was recreated or appeared
	if fw.file == nil {
		fw.mu.Unlock()
		log.Printf("File %s appeared/recreated, reloading from beginning", fw.filePath)
		// Clear existing logs since file was recreated
		fw.parser.ClearLogs()
		fw.openFile()
		// Read entire file from beginning
		fw.lastPos = 0
		fw.file.Seek(0, io.SeekStart)
		fw.reader = bufio.NewReader(fw.file)
		fw.readNewLines()
		return
	}

	// File was truncated
	if currentSize < fw.lastSize {
		log.Printf("File %s was truncated, reloading from beginning", fw.filePath)
		fw.lastPos = 0
		fw.file.Seek(0, io.SeekStart)
		fw.reader = bufio.NewReader(fw.file)
		// Clear existing logs since file was truncated
		fw.parser.ClearLogs()
	}

	// File has new content
	if currentSize > fw.lastPos {
		fw.mu.Unlock()
		fw.readNewLines()
	} else {
		fw.mu.Unlock()
	}

	fw.mu.Lock()
	fw.lastSize = currentSize
	fw.mu.Unlock()
}

func (fw *FileWatcher) watchLoop() {
	for {
		select {
		case <-fw.stopChan:
			return
		case event, ok := <-fw.watcher.Events:
			if !ok {
				return
			}

			// Check if the event is for our file
			if filepath.Clean(event.Name) == filepath.Clean(fw.filePath) {
				switch {
				case event.Op&fsnotify.Write == fsnotify.Write:
					fw.checkFile()
				case event.Op&fsnotify.Create == fsnotify.Create:
					log.Printf("File %s was created", fw.filePath)
					time.Sleep(100 * time.Millisecond) // Give it time to be written
					fw.openFile()
					fw.readNewLines()
				case event.Op&fsnotify.Remove == fsnotify.Remove:
					fw.mu.Lock()
					if fw.file != nil {
						log.Printf("File %s was removed", fw.filePath)
						fw.file.Close()
						fw.file = nil
						fw.lastPos = 0
						fw.lastSize = 0
					}
					fw.mu.Unlock()
				case event.Op&fsnotify.Rename == fsnotify.Rename:
					fw.mu.Lock()
					if fw.file != nil {
						log.Printf("File %s was renamed", fw.filePath)
						fw.file.Close()
						fw.file = nil
						fw.lastPos = 0
						fw.lastSize = 0
					}
					fw.mu.Unlock()
				}
			}
		case err, ok := <-fw.watcher.Errors:
			if !ok {
				return
			}
			log.Printf("File watcher error: %v", err)
		}
	}
}

func (fw *FileWatcher) pollLoop() {
	ticker := time.NewTicker(fw.checkInterval)
	defer ticker.Stop()

	for {
		select {
		case <-fw.stopChan:
			return
		case <-ticker.C:
			fw.checkFile()
		}
	}
}