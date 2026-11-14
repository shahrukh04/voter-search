import React, { useEffect, useState } from 'react';

let promptEvent;
let installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
function notify() { window.dispatchEvent(new Event('install-state')); }
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  promptEvent = event;
  notify();
});
window.addEventListener('appinstalled', () => {
  installed = true;
  promptEvent = null;
  notify();
});

export default function InstallApp({ className }) {
  const [hidden, setHidden] = useState(Boolean(installed));
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const sync = () => setHidden(Boolean(installed));
    window.addEventListener('install-state', sync);
    return () => window.removeEventListener('install-state', sync);
  }, []);
  async function install() {
    if (!promptEvent) { setHelp(value => !value); return; }
    const event = promptEvent;
    promptEvent = null;
    try { await event.prompt(); await event.userChoice; }
    catch { setHelp(true); }
  }
  if (hidden) return null;
  return <>
    <button type="button" className={className} onClick={install}>ऐप इंस्टॉल करें</button>
    {help && <p role="status">Android पर Chrome के मेन्यू में “Install app” या “Add to Home screen” चुनें। iPhone पर Safari में शेयर खोलें और “Add to Home Screen” चुनें।</p>}
  </>;
}
