export async function downloadBrowserFile(requestFile, environment = {}) {
  const documentRef = environment.documentRef || document;
  const urlRef = environment.urlRef || URL;
  const { blob, filename } = await requestFile();
  const objectUrl = urlRef.createObjectURL(blob);
  const anchor = documentRef.createElement("a");
  try {
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.hidden = true;
    documentRef.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    urlRef.revokeObjectURL(objectUrl);
  }
  return { filename, size: blob.size };
}
