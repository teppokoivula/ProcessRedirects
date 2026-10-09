# ProcessRedirects

A robust, production-grade redirect management module for [ProcessWire CMS/CMF](https://processwire.com/).

Manage HTTP redirects (301, 302, 303, 307, 308) directly from the ProcessWire admin panel with wildcard matching, query string support, dynamic page references, and CSV batch import/export.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage Guide](#usage-guide)
  - [Adding a Redirect](#adding-a-redirect)
  - [Source Path Patterns](#source-path-patterns)
  - [Target Types & Dynamic Page References](#target-types--dynamic-page-references)
  - [HTTP Redirect Status Codes](#http-redirect-status-codes)
- [Batch Import & Export](#batch-import--export)
  - [CSV Format Specification](#csv-format-specification)
  - [Importing via Text Input or File Upload](#importing-via-text-input-or-file-upload)
  - [Exporting and CSV Download](#exporting-and-csv-download)
- [Architecture & Performance](#architecture--performance)
  - [404 Interception Mechanism](#404-interception-mechanism)
  - [Database Engine & Concurrency](#database-engine--concurrency)
  - [Database Schema & Migrations](#database-schema--migrations)
- [Permissions & Security](#permissions--security)
- [Troubleshooting & FAQ](#troubleshooting--faq)
- [Version History](#version-history)
- [License & Credits](#license--credits)

---

## Overview

When redesigning or migrating websites, old URLs frequently change or become obsolete. Broken inbound links hurt SEO rankings and degrade user experience.

**ProcessRedirects** provides a centralized control center located at **Setup > Redirects** in the ProcessWire Admin. Unlike server-level `.htaccess` configurations that require FTP access or dev intervention, content managers and SEO specialists can manage URL redirects safely through a friendly, intuitive UI.

> [!NOTE]
> ProcessRedirects hooks into `ProcessPageView::pageNotFound`. This means redirect lookups are executed **only when a 404 occurs**, introducing **zero database overhead** for requests to valid, existing pages!

---

## Key Features

- **Full HTTP Status Code Support:** Select between `301`, `302`, `303`, `307`, and `308` per redirect or set a global default.
- **Active / Inactive Status Toggle:** Temporarily disable individual redirects without deleting them.
- **Instant Client-Side Table Search:** Filter hundreds of redirects in real time as you type with live result counters and keyboard shortcut (`Esc` to clear).
- **Master "Select All" Toggle:** Bulk select and manage redirects with visual row highlighting and indeterminate state tracking.
- **Infinite Loop Prevention:** Automated client and server-side checks block self-redirects before they happen.
- **Smart URL Normalization:** Automatically strips current domain schemes from pasted URLs, enforces leading slashes, and cleanly encodes whitespace.
- **Flexible CSV Delimiter Support:** Seamlessly auto-detects commas (`,`), semicolons (`;`), or tabs (`\t`) during batch imports.
- **Zero Overhead on Normal Requests:** Only triggers when ProcessWire hits a 404 Page Not Found.
- **Dynamic ProcessWire Page References:** Linking to an internal page stores the Page ID (`^1234`). If that target page is later renamed or moved in the page tree, the redirect automatically updates!
- **Wildcard Matching (`*`):** Match URL patterns and subpaths (e.g. `/products/*` redirects to `/products/`).
- **Query String Matching:** Match legacy URLs with query parameters (e.g. `/index.php?page=2`).
- **Batch CSV Import & Export:** Bulk import hundreds of redirects via direct copy-paste or file upload, and export them as CSV with full status and active flags.
- **Built-in Live Testing:** Test any redirect directly in a slide-out panel from the admin data table.
- **Hit Tracking:** Keep track of redirect popularity and monitor traffic migration with the built-in hit counter.
- **Internationalization (i18n):** Multi-language ready with bundled translations for Turkish (`tr`), German (`de`), Russian (`ru`), French (`fr`), Spanish (`es`), Finnish (`fi`), and English (`en`).

---

## Requirements

- **ProcessWire:** `>= 3.0.112` (Fully tested on `3.0.270+`)
- **PHP:** `>= 7.4` (Fully compatible with PHP `8.0`, `8.1`, `8.2`, `8.3`, and `8.4+`)
- **Database:** MySQL `5.6+` / `8.0+` or MariaDB `10.1+`

---

## Installation

### Method 1: ProcessWire Admin (Recommended)

1. In the ProcessWire Admin, navigate to **Modules > Site > Add New**.
2. Enter the class name `ProcessRedirects` and click **Install**.
3. The module will automatically create the database table and install the admin page under **Setup > Redirects**.

### Method 2: Composer

Run the following command in your project root:

```bash
composer require apeisa/process-redirects
```

Then visit **Modules > Refresh** in the Admin and click **Install** next to **Redirects**.

### Method 3: Wire CLI

If you have ProcessWire CLI installed:

```bash
wire module:install ProcessRedirects
```

### Method 4: Manual Git Clone

Clone into your site modules directory:

```bash
cd site/modules/
git clone https://github.com/teppokoivula/ProcessRedirects.git
```

Then refresh modules in the Admin and click **Install**.

---

## Configuration

Navigate to **Modules > Configure > ProcessRedirects** to customize module settings:

| Setting | Type | Default | Description |
|---|---|---|---|
| `default_redirect_code` | `int` | `301` | Default HTTP status code applied to newly created redirects and imports omitting a status code. |

---

## Usage Guide

### Adding a Redirect

1. Navigate to **Setup > Redirects** in the admin menu.
2. Click the **Add redirect** button in the header.
3. Fill in the fields:
   - **Redirect From:** The relative path that was requested and returned a 404.
   - **Redirect To:** Select a target page using the Page List Selector, or enter an external URL or relative path.
   - **HTTP Redirect Status Code:** Select the appropriate status code (defaults to your module configuration).
4. Click **Save**.

### Source Path Patterns

The `Redirect From` field accepts relative local paths. Leading slashes are added automatically if omitted.

Supported pattern examples:

- **Simple paths:** `/old-page/` or `/about/company-history/`
- **Paths with file extensions:** `/press/release-2020.html` or `/download/brochure.pdf`
- **Query strings:** `/index.php?page=contact&lang=en`
- **Wildcards (`*`):** Use `*` to match zero or more characters:
  - `/blog/2018/*` matches `/blog/2018/my-post/`, `/blog/2018/tags/`, etc.
  - `/catalog/discontinued-*` matches `/catalog/discontinued-item-123`

> [!IMPORTANT]
> The source path must **not** match an existing, viewable page on the site. An active ProcessWire page always takes precedence over a redirect.

### Target Types & Dynamic Page References

The `Redirect To` destination supports three formats:

1. **Page Selector (Dynamic Page Reference):** When selecting an internal page via the PageListSelect input, the redirect stores the Page ID prefixed by a caret (`^1234`). If the page is renamed or moved to another parent, the redirect target remains valid.
2. **Relative Path:** `/new-section/services/`
3. **External URL:** `https://www.example.com/target/` (query strings and hash anchors are preserved).

Query parameters from the requested URL are automatically appended to the target URL unless overridden.

### HTTP Redirect Status Codes

ProcessRedirects supports modern HTTP status codes according to RFC 7231 and RFC 7538:

| Code | Status | Best Used For | Browser Caching |
|---|---|---|---|
| **301** | Moved Permanently | Permanent migrations, domain changes, retired content. Search engines transfer SEO link equity (PageRank) to the target. | Yes (Heavily cached) |
| **302** | Found (Temporary) | Temporary landing pages, seasonal campaigns, maintenance notices, A/B tests. | No |
| **303** | See Other | Redirecting after form submissions or API requests to a GET resource. | No |
| **307** | Temporary Redirect | Temporary redirect guaranteeing that the HTTP method (e.g. POST) is not changed to GET. | No |
| **308** | Permanent Redirect | Permanent equivalent of 307; guarantees that the HTTP request method remains unchanged. | Yes |

---

## Batch Import & Export

When migrating an entire website from an old CMS (WordPress, Drupal, Magento), manually adding hundreds of redirects one by one is impractical. ProcessRedirects includes a high-speed batch importer and exporter.

### CSV Format Specification

The CSV syntax supports **2-column**, **3-column**, and **4-column** formats:

```csv
redirect_from,redirect_to[,redirect_code][,active]
```

- **Delimiters:** The importer automatically detects comma (`,`), semicolon (`;`), and tab (`\t`) delimiters, making it seamlessly compatible with Excel exports from all international locales.
- **Columns:**
  1. `redirect_from` (Required): The relative local path or wildcard pattern.
  2. `redirect_to` (Required): Target internal path, external URL, or dynamic page ID (`^1234`).
  3. `redirect_code` (Optional): HTTP status code (`301`, `302`, `303`, `307`, `308`). Defaults to configured module default if omitted.
  4. `active` (Optional): `1` (or `true`, `active`) / `0` (or `false`, `inactive`). Defaults to `1` (active) if omitted.

#### Example CSV Content:

```csv
/campaign/,/products/tools/offers/,301,1
/temporary-sale/,/offers/,302,1
/old-checkout/,https://secure.example.com/checkout/,307,0
/legacy/contact.html,/contact-us/
/blog/archive/*,/blog/
```

- If `redirect_code` is omitted, it automatically adopts the **Default Redirect HTTP Status Code** configured in module settings.
- The optional header row (`redirect_from,redirect_to,redirect_code,active`) is detected and skipped automatically.
- Quotes around values and whitespace around delimiters are automatically trimmed.
- Self-redirect loops (`redirect_from === redirect_to`) are caught and skipped with a descriptive warning.

### Importing via Text Input or File Upload

1. Navigate to **Setup > Redirects > Import**.
2. Select **Text input** to paste CSV lines directly into the textarea, or select **File upload** to upload a `.csv` file.
3. Click **Add New Redirects**.
4. The system validates each row, deduplicates duplicates, and reports the number of added, updated, and skipped rows.

### Exporting and CSV Download

- Navigate to **Setup > Redirects > Export** to view all redirects formatted as CSV in a copyable textarea.
- Click **Download CSV** to generate and download an attachment file named `redirects_YYYY-MM-DD_HH-mm.csv` (contains full 4-column CSV with active flags).

---

## Architecture & Performance

### 404 Interception Mechanism

```
Visitor Request → ProcessWire Router → Page Found?
                                          │
                        ┌─────────────────┴─────────────────┐
                       YES                                  NO (404)
                        │                                   │
               Render Template Page             ProcessPageView::pageNotFound Hook
              (ProcessRedirects idle)                       │
                                                    Query process_redirects
                                                            │
                                                ┌───────────┴───────────┐
                                              MATCH                    NO MATCH
                                                │                       │
                                        Update Hit Counter      Display 404 Page
                                                │
                                    Send HTTP Header (301/302)
                                                │
                                        Redirect Visitor
```

### Database Engine & Concurrency

The module dynamically respects ProcessWire's `$config->dbEngine` setting (defined in `site/config.php`), defaulting to modern transaction-safe engines (`InnoDB`) instead of legacy MyISAM table locks for high-concurrency environments.

### Database Schema & Migrations

The database table `process_redirects` schema:

```sql
CREATE TABLE `process_redirects` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `counter` int(10) unsigned DEFAULT 0,
  `redirect_code` smallint(5) unsigned NOT NULL DEFAULT 301,
  `active` tinyint(1) unsigned NOT NULL DEFAULT 1,
  `redirect_from` varchar(250) NOT NULL DEFAULT '',
  `redirect_to` varchar(250) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `redirect_from` (`redirect_from`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

The module automatically migrates older schemas:
- **Schema v1 -> v2:** Table rename normalization.
- **Schema v2 -> v3:** Column length adjustment to 250 characters.
- **Schema v3 -> v4:** Adds `redirect_code` column and converts table engine to InnoDB.
- **Schema v4 -> v5:** Adds `active` column (1 = active, 0 = inactive) for disabling redirects without deletion.

---

## Permissions & Security

- **Permission:** Access to the redirects administration view is governed by the `redirects-admin` permission. Only superusers and roles granted `redirects-admin` can view, create, edit, or delete redirects.
- **CSRF Protection:** All mutating actions (Save, Batch Import, Delete) are protected with ProcessWire's `$session->CSRF` token validation.
- **SQL Prepared Statements:** All database interactions utilize prepared statements with strict parameter binding (`\PDO::PARAM_STR`, `\PDO::PARAM_INT`).
- **Input Sanitization:** URL inputs are sanitized with `$sanitizer->path()`, `$sanitizer->url()`, and HTML outputs in data tables are escaped via `$sanitizer->entities()`.

---

## Troubleshooting & FAQ

### Why is my redirect not firing?
1. **Redirect is Inactive:** Check if the redirect is marked `Inactive` in the table or edit screen.
2. **Existing Page Conflict:** If a published page exists with the same path, ProcessWire serves the page. Redirects only trigger on 404s.
3. **Browser Cache:** Browsers cache `301 Moved Permanently` redirects aggressively. Test in an Incognito/Private window or use `curl -I https://yoursite.com/old-path/` to check headers.
4. **Trailing Slashes:** Make sure your URL matches your site's trailing slash policy (ProcessWire template URL settings).

### Can I redirect query strings?
Yes! Enter the query string in the `Redirect From` field, for example: `/index.php?option=com_content&id=42`. ProcessRedirects detects query strings in the source path and matches them against `$_SERVER['REQUEST_URI']`.

---

## Version History

- **2.4.0**
  - Added **Active / Inactive** status toggle (Schema v5) to enable/disable redirects without deleting them.
  - Complete **JavaScript overhaul (`admin.js`)**:
    - Smart URL normalization: auto-extracts relative paths if full origin URLs are pasted.
    - Global whitespace replacement fixing single-space encoding bug.
    - Interactive HTTP status code badge with real-time SEO and caching explanations.
    - Client-side loop prevention alert before form submission.
    - Instant client-side search across redirects table with live match counter and `Esc` shortcut.
    - Master "Select All" checkbox toggle with visual row selection highlighting and indeterminate state tracking.
  - Server-side infinite redirect loop detection in `executeSave()` and `executeSavearray()`.
  - Flexible CSV delimiter auto-detection (`,`, `;`, `\t`) for cross-locale spreadsheet imports.
  - Full round-trip 4-column CSV import/export (`redirect_from,redirect_to,redirect_code,active`).
  - Added comprehensive localization support with bundled translations for Turkish (`tr`), German (`de`), Russian (`ru`), French (`fr`), Spanish (`es`), and Finnish (`fi`).
- **2.3.0**
  - Added support for selectable HTTP redirect status codes (`301`, `302`, `303`, `307`, `308`) per redirect and global default setting ([#9](https://github.com/teppokoivula/ProcessRedirects/issues/9)).
  - Upgraded table storage engine to **InnoDB** with automatic migration from MyISAM ([#26](https://github.com/teppokoivula/ProcessRedirects/issues/26)).
  - Enhanced CSV import and export to support 3-column syntax with status codes.
  - Hardened PHP 8.1 - 8.4+ compatibility and CLI/Tinker resilience.
  - Added status code display column and HTML entity escaping in admin data table.
  - Expanded Finnish translations (`languages/fi.csv`).
  - Comprehensive documentation rewrite.
- **2.2.5**
  - Update path for translations.
- **2.2.3**
  - Bundle Finnish translations.
- **2.2.2**
  - Fix PHP warning when requested URL starts with multiple slashes.
- **2.2.1**
  - Use `preg_split` and trim quotes from CSV imports ([#25](https://github.com/teppokoivula/ProcessRedirects/issues/25)).
- **2.2.0**
  - Added CSV import/export support.

---

## License & Credits

- **Original Authors:** Antti Peisa ([@apeisa](https://github.com/apeisa)) & Teppo Koivula ([@teppokoivula](https://github.com/teppokoivula))
- **Discussion Forum:** [ProcessWire Forum Support Thread](https://processwire.com/talk/topic/148-release-redirects/)
- **License:** [GPL-2.0-or-later](LICENSE)