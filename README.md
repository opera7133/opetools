# opetools

https://tools.wmsci.com

Various tools for me to use

## Licenses

MIT License

## Storage and attendance notifications

Foods, retail and attendance use separate v2 endpoints and separate personal tokens. Cloud reads require the token's edit key; snapshot updates detect changes on another device. Unsynced local data stays in the browser when an upload fails. Downloading dirty foods/retail data requires confirmation; automatic downloads do not discard it.

Attendance codes are updated individually. Failed updates remain in a local pending list. Use **未同期コードを確認して再送** to review a conflict with another device/participant. Configuration snapshots and imported history do not send Discord notifications.

To migrate attendance from v1, first read and export the data to preserve it, then use **現在のデータを出席専用v2へ移行**. It creates a new personal token without changing the old one. The JSON backup contains timetable/settings/history and shared course IDs, but no credentials, participation key, or pending transmission jobs.

Discord participation uses a separate operator-provided participation key. Map each local subject name to the agreed shared course ID, including year, offering and section. Only mapped courses notify. Personal histories remain separate; notifications are shared by course/day. Corrections edit the existing message. Changing a course ID does not move old messages.

`kyomu.user.js` is the editable source for the manually maintained Gist. Version 0.3 uses the attendance v2 endpoint by default; existing users must migrate their token and select v2 in the userscript menu. Configure the Worker URL to the actual deployment. Consecutive periods are recorded at the first period. Inputs are recorded when the university registration button is clicked; they are not proof of registration success. Network timeouts release the original button so submission can continue.

Retail comparison cards and trend charts use one selected unit at a time. Historical bottom prices are separate from current store prices. Foods stores an inventory baseline and derives remaining stock from retained consumption records, so editing/deleting consumption restores stock consistently. Older snapshots migrate while preserving their current remaining amount. New prep records link to their output food; an output already used by another record cannot be removed without resolving those dependent records.

## Development checks

- `npm test`: frontend storage, synchronization, comparison, inventory and UserScript regression tests.
- `npm run build`: static Astro build.
- Worker setup/deployment and notification recovery are documented in `opetools-workers/README.md`.
