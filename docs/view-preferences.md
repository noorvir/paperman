# View preferences

The URL is the live source of browsing state. Local storage is a saved copy for return visits.

1. A route validates the parameters that were supplied. Missing parameters remain absent.
2. On fresh entry, before its loader runs, the route fills missing preferences from local storage, then schema defaults. Explicit values, including empty filters and default choices, win over storage.
3. The router removes empty and default values from the resolved URL. Only active filters and non-default choices remain.
4. Loaders and controls read the URL. Controls update it through the router.
5. Route enter/stay callbacks save the committed preferences. Preloads and cancelled navigation do not save them.

These routes use client loading because local storage is unavailable on the server. The app shell and authentication checks retain server rendering. Search validation preserves absent fields. Default removal also runs in the browser, so a server redirect cannot discard explicit resets before storage is read.

Changes within an active route use schema defaults for omitted fields. Each resolved history entry records its preference group and account keys, without copying the preference values. Back, Forward, and reload therefore preserve a cleared filter even when storage contains a newer selection. Restoring preferences replaces history; normal view changes retain the router's history behavior. PDF zoom and view-tab changes use replacement. Shared PDF zoom and editor tabs remain selected through links unless explicitly reset.

A copied link supplies its active choices. On fresh entry, missing choices use that browser's saved preferences or the defaults.

## Audit coverage

| Surface                  | Saved view preferences                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documents                | Search, owners, creators, tags, date range, processing status, routing status, inbox, sort column/direction, list/grid, visible columns, view tab, source context |
| Scans                    | Search, inbox, processing status                                                                                                                                  |
| Scan details and preview | View tab, document list/grid                                                                                                                                      |
| Overview                 | Status filter, mobile Documents/Needs attention section                                                                                                           |
| Roadmap                  | Category                                                                                                                                                          |
| PDF viewers              | Zoom/fit choice, shared across documents, scans, scan review, and document creation                                                                               |
| Document editor          | Selected tab; document edits still require Save                                                                                                                   |

Processing configuration and time format already persist on the server. Catalog pages have no adjustable view controls. User/member lists have pagination and selection, but no filters, sort controls, or layout choices.

Pagination, the selected document/user, preview/edit mode, dialogs, disclosure panels, PDF page/search/view rotation, upload files/destination, draft form values, and God mode are temporary navigation, transaction, or security state. They are not restored from preference storage. Development preview routes are excluded.

## Storage and failure behavior

Keys use `paperman.preferences.v1:<scope>:<group>`. Authenticated scopes include the user ID; auth-disabled mode has a separate scope. Browsers and origins keep separate stores. The old `paperman.document-columns` value is imported when the new document preference record does not yet exist.

Only schema-approved fields are saved. Corrupt records fall back to defaults. Blocked or full storage does not prevent controls from working through the URL. A storage change in another tab does not change the active tab's URL; a later route entry can read the saved values.

## Checks

Run `bun --filter @paperman/web test:preferences` for router checks. To include the browser workflow, set `PAPERMAN_WEB_URL` to a local test instance and `PAPERMAN_BROWSER_URL` to an existing Chrome debug endpoint. The browser check uses a separate context and copies only the existing session cookies. It changes view preferences, not documents.

The router checks cover restoration, default removal, explicit resets, resolved history entries, account scopes, preloading, and corrupt/blocked storage. The browser workflow covers the actual view controls, compact URLs, reloads, return visits, Back/Forward across routes, legacy columns, filters, and shared PDF preferences.
