export function splitGV(gv: string): [string, string] {
  const parts = gv.split("/");
  return parts.length === 1
    ? ["", parts[0]]
    : [parts[0], parts[1]];
}

export function splitGVK(gvk: string): [string, string] {
  const parts = gvk.split("/");
  return parts.length === 2
    ? [parts[0], parts[1]]
    : [parts[0] + "/" + parts[1], parts[2]];
}
