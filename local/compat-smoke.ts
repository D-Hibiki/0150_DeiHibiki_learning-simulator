import { getOllamaStatus } from "./ollama-policy";
import { runCouncilCompatibilitySmoke } from "./research-council";

const status = await getOllamaStatus();
if (!status.available) throw new Error(status.message);
if (!status.modelInstalled) throw new Error(`${status.model} is not installed`);
const output = await runCouncilCompatibilitySmoke();
console.log(JSON.stringify({ status, output }, null, 2));
