type DownloadableAttachment = { name: string; bytes: Uint8Array };

function downloadAttachment(file: DownloadableAttachment): void {
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(file.bytes)], { type: 'application/octet-stream' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { downloadAttachment };
