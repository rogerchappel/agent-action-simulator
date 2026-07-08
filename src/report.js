export function formatMarkdownReport(simulation) {
  const lines = ['# Agent Action Simulation', ''];
  lines.push('## Summary');
  for (const [outcome, count] of Object.entries(simulation.summary)) {
    lines.push(`- ${outcome}: ${count}`);
  }
  lines.push('', '## Actions');
  for (const result of simulation.results) {
    const approval = result.approval ? ` Approval: ${result.approval}.` : '';
    lines.push(`- ${result.id ?? `index-${result.index}`}: ${result.outcome} - ${result.reason}.${approval}`);
    if (result.fields.length > 0) {
      lines.push(`  Fields: ${result.fields.join(', ')}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

export function formatJsonReport(simulation) {
  return `${JSON.stringify(simulation, null, 2)}\n`;
}
