const ANSI_ESCAPE =
  /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/gi;

const ORPHAN_SGR = /\[[0-9;]*m/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE, "").replace(ORPHAN_SGR, "");
}
