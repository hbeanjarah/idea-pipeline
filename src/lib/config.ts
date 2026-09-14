// The one place the API address is written. vite.config.ts imports this to
// build host_permissions, and the worker resolves the runtime value from it:
// if the manifest and the fetch disagree, Chrome blocks the request and
// nothing explains why.
//
// Nothing here may touch import.meta.env — this module is also evaluated by
// vite.config.ts, in Node, where it does not exist.
export const DEFAULT_API_URL = 'http://localhost:3000';
