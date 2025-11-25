# Feature Updates - Filter Improvements & Environment Variables

This document describes the new features and improvements added to the Traefik Log Dashboard.

## 1. Fixed IP Filter Behavior (Include/Exclude Modes)

### Problem
Previously, custom filters could only **exclude** logs (hide logs that match the filter). When users tried to filter for a specific IP using "equals" or "contains", they would see OTHER IPs instead of the one they searched for, because the filter was hiding the matching IP.

### Solution
Added a new **Filter Mode** feature that supports two types of filtering:

- **Exclude Mode** (default): Hides logs that match the filter condition
- **Include Mode** (new): Shows ONLY logs that match the filter condition

### How to Use

1. Go to **Settings → Filters**
2. Click **"Add Condition"**
3. Configure your filter:
   - **Name**: e.g., "Show Japan traffic"
   - **Field**: Select the field to filter (IP, Country, City, etc.)
   - **Operator**: Choose how to match (equals, contains, etc.)
   - **Value**: Enter the value to match (e.g., "103.5.140.142" or "Japan")
   - **Filter Mode**:
     - Select **"Include (Show ONLY matching logs)"** to see only logs from that IP/country
     - Select **"Exclude (Hide matching logs)"** to hide logs from that IP/country

### Example Use Cases

#### Example 1: View traffic from a specific IP
- **Field**: ClientHost
- **Operator**: equals
- **Value**: 103.5.140.142
- **Mode**: Include ✓

This will show ONLY logs from IP 103.5.140.142.

#### Example 2: View traffic from Japan
- **Field**: Country
- **Operator**: equals
- **Value**: Japan
- **Mode**: Include ✓

This will show ONLY logs from Japan.

#### Example 3: Hide health check endpoints
- **Field**: RequestPath
- **Operator**: contains
- **Value**: /health
- **Mode**: Exclude ✓

This will hide all logs with "/health" in the path.

---

## 2. Country and City Columns in Recent Logs Table

### What's New
Added **Country** and **City** as optional columns in the Recent Logs table.

### How It Works
- Logs are automatically enriched with geolocation data (country and city) when they arrive
- The geolocation is looked up via the agent's GeoIP API
- Country and City appear as toggleable columns in the table

### How to Enable

1. Go to the **Dashboard** page
2. In the **Recent Logs** card, click the **"Additional Columns"** dropdown (top-right)
3. Check the boxes for:
   - ✓ **Country** - Shows the country code (e.g., "US", "JP", "DE")
   - ✓ **City** - Shows the city name (e.g., "Tokyo", "New York", "London")

### Special Values
- **"Private"**: Shows for private/local IP addresses (10.x.x.x, 192.168.x.x, etc.)
- **"Unknown"**: Shows when geolocation lookup fails or IP is not in the database

### Filter by Country/City
You can now create custom filters based on geolocation:
- **Field**: geoCountry or geoCity
- **Operator**: equals, contains, etc.
- **Value**: Country code (e.g., "JP") or city name
- **Mode**: Include or Exclude

---

## 3. Environment Variables

### New Environment Variables

Create a `.env.local` file in the `dashboard` folder with these variables:

```bash
# Dashboard Environment Variables

# API Configuration
NEXT_PUBLIC_AGENT_API_URL=http://traefik-agent:5000
NEXT_PUBLIC_AGENT_API_TOKEN=

# Display Configuration
NEXT_PUBLIC_SHOW_DEMO_PAGE=true
NEXT_PUBLIC_MAX_LOGS_DISPLAY=500
```

### Variable Details

#### `NEXT_PUBLIC_SHOW_DEMO_PAGE`
- **Type**: boolean (true/false)
- **Default**: true
- **Purpose**: Show or hide the demo page
- **Effect**:
  - When `false`: Demo page links are hidden from homepage and header
  - Demo page route (`/dashboard/demo`) will still be accessible if users know the URL
  - Use this in production to hide demo mode from users

**Example:**
```bash
# Hide demo page in production
NEXT_PUBLIC_SHOW_DEMO_PAGE=false
```

#### `NEXT_PUBLIC_MAX_LOGS_DISPLAY`
- **Type**: number
- **Default**: 500
- **Purpose**: Maximum number of logs to display in the Recent Logs table
- **Effect**: Controls how many log entries are shown in the table (affects performance)

**Example:**
```bash
# Show up to 500 logs in the table
NEXT_PUBLIC_MAX_LOGS_DISPLAY=500

# Or show fewer for better performance
NEXT_PUBLIC_MAX_LOGS_DISPLAY=200
```

### How to Apply Changes

After creating/modifying `.env.local`:

1. **Development mode**:
   ```bash
   # Restart the development server
   npm run dev
   ```

2. **Production mode**:
   ```bash
   # Rebuild and restart
   npm run build
   npm run start
   ```

3. **Docker**:
   ```bash
   # Rebuild the container
   docker-compose up -d --build dashboard
   ```

---

## 4. Complete Workflow Examples

### Workflow 1: Investigate Traffic from Japan

**Goal**: See all traffic from Japan and identify the IPs accessing your services.

1. **Enable Country column**:
   - Dashboard → Recent Logs → Additional Columns → ✓ Country

2. **Create an include filter for Japan**:
   - Settings → Filters → Add Condition
   - Name: "Japan Traffic"
   - Field: geoCountry
   - Operator: equals
   - Value: JP
   - Mode: Include ✓
   - Click "Add Condition"

3. **View the results**:
   - Return to Dashboard
   - Recent Logs table now shows ONLY logs from Japan
   - You can see all the IPs in the "Client IP" column

4. **Filter by a specific IP**:
   - If you see IP "103.5.140.142" and want to see only that IP's activity:
   - Settings → Filters → Add Condition
   - Name: "Specific Japan IP"
   - Field: ClientHost
   - Operator: equals
   - Value: 103.5.140.142
   - Mode: Include ✓
   - Disable the "Japan Traffic" filter (uncheck it)
   - Enable the "Specific Japan IP" filter

### Workflow 2: Production Configuration

**Goal**: Hide demo page and optimize performance.

1. **Create `.env.local` file**:
   ```bash
   # Production settings
   NEXT_PUBLIC_SHOW_DEMO_PAGE=false
   NEXT_PUBLIC_MAX_LOGS_DISPLAY=200
   NEXT_PUBLIC_AGENT_API_URL=http://traefik-agent:5000
   NEXT_PUBLIC_AGENT_API_TOKEN=your-secret-token-here
   ```

2. **Rebuild**:
   ```bash
   npm run build
   npm run start
   ```

3. **Verify**:
   - Demo links should be hidden from homepage
   - Recent Logs table shows max 200 entries
   - Better performance due to reduced rendering load

---

## Technical Details

### File Changes

1. **Filter Types** (`dashboard/lib/types/filter.ts`):
   - Added `mode?: 'exclude' | 'include'` to `FilterCondition`
   - Added `'country' | 'city'` to filter type options

2. **Filter Logic** (`dashboard/lib/utils/filter-utils.ts`):
   - Updated `applyFilters()` to support include/exclude modes
   - Include filters are processed first (show ONLY matching logs)
   - Exclude filters are processed second (hide matching logs)

3. **Geolocation** (`dashboard/lib/types.ts`, `dashboard/lib/location.ts`):
   - Added `geoCountry?: string` and `geoCity?: string` to `TraefikLog` interface
   - Created `enrichLogsWithGeoLocation()` function to add geo data to logs

4. **Dashboard Page** (`dashboard/app/dashboard/page.tsx`):
   - Integrated geolocation enrichment when logs are fetched
   - Logs are enriched with country/city before being stored in state

5. **Recent Logs Table** (`dashboard/components/dashboard/cards/RecentLogsTable.tsx`):
   - Added Country and City to optional columns
   - Added environment variable support for `NEXT_PUBLIC_MAX_LOGS_DISPLAY`

6. **Filter Settings UI** (`dashboard/app/settings/filters/page.tsx`):
   - Added Filter Mode dropdown (Include/Exclude)
   - Added Country and City to field options
   - Display mode badge on existing filters

7. **Homepage** (`dashboard/app/page.tsx`):
   - Conditionally hide demo page links based on `NEXT_PUBLIC_SHOW_DEMO_PAGE`

8. **Environment** (`dashboard/.env.example`):
   - Created example file with all available environment variables

### Performance Considerations

- **Geolocation lookups**: Batched and cached by the agent API
- **Display limit**: Configurable via `NEXT_PUBLIC_MAX_LOGS_DISPLAY` to control rendering performance
- **Memory limit**: Dashboard keeps max 1000 logs in memory (unchanged)
- **Table rendering**: Only displays configured max (default 500)

---

## Migration Notes

### Existing Filters
- All existing custom filters will default to **"Exclude"** mode (backward compatible)
- No action needed for existing filters to continue working

### New Installations
- Copy `.env.example` to `.env.local` and configure as needed
- Default values work out-of-box for most use cases

---

## Troubleshooting

### Issue: Custom filter shows no logs
**Cause**: You may have both include and exclude filters active that conflict.

**Solution**:
1. Go to Settings → Filters
2. Check which filters are enabled (green "Active" badge)
3. If you have include filters, they take precedence - only logs matching the include filter will show
4. Disable conflicting filters or adjust your filter logic

### Issue: Country/City columns show "Unknown"
**Cause**:
- GeoIP lookup failed
- IP is not in the GeoIP database
- Agent's GeoIP feature is disabled

**Solution**:
1. Verify agent has GeoIP enabled in its `.env`:
   ```bash
   TRAEFIK_LOG_DASHBOARD_GEOIP_ENABLED=true
   TRAEFIK_LOG_DASHBOARD_GEOIP_CITY_DB=GeoLite2-City.mmdb
   TRAEFIK_LOG_DASHBOARD_GEOIP_COUNTRY_DB=GeoLite2-Country.mmdb
   ```
2. Ensure MaxMind GeoLite2 database files are present
3. Check agent logs for errors

### Issue: Demo page still visible after setting NEXT_PUBLIC_SHOW_DEMO_PAGE=false
**Cause**: Environment variables require rebuild.

**Solution**:
```bash
# Restart in development
npm run dev

# Or rebuild for production
npm run build
npm run start
```

---

## Summary

All four feature requests have been implemented:

✅ **1. Fixed IP filtering** - Added Include/Exclude modes to custom filters
✅ **2. Country/City columns** - Added as optional columns in Recent Logs table
✅ **3. Country-based filtering** - Can filter by geoCountry or geoCity fields
✅ **4. Hide demo page** - Controlled by `NEXT_PUBLIC_SHOW_DEMO_PAGE` environment variable
✅ **5. Configurable log limit** - Controlled by `NEXT_PUBLIC_MAX_LOGS_DISPLAY` environment variable (default 500)

All features are backward compatible and work together seamlessly.
