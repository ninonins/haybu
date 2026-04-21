export function audit(event, details = {}) {
  console.log(JSON.stringify({ type: "audit", event, at: new Date().toISOString(), details }));
}
