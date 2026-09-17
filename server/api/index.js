// Vercel invokes the Express handler; local startup stays in index.js.
import { createRuntimeApp } from '../runtime.js';
// This entrypoint is only deployed as a Vercel function; no env detection needed.
export default createRuntimeApp(true);
