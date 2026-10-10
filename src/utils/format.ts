export const number = (v: number, digits = 0) =>
  v.toLocaleString("en-US", { maximumFractionDigits: digits });
export const compact = (v: number) =>
  Math.abs(v) >= 1e6
    ? `${(v / 1e6).toFixed(2)}M`
    : Math.abs(v) >= 1000
      ? `${(v / 1000).toFixed(v >= 100000 ? 0 : 1)}k`
      : number(v, 1);
export const percent = (v: number) => `${number(v, 1)}%`;
export const download = (name: string, content: unknown) => {
  const blob = new Blob(
    [typeof content === "string" ? content : JSON.stringify(content, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
