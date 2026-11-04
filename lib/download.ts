/** Starts a file download without leaving the page. */
export function startDownload(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  link.click();
}
