// Open an existing customer's drawing, or collect the measured room first.
import {openWorkspace} from './kitchen-workspace-entry.js';
import {bootstrapSharedWorkspace} from './kitchen-scoped-client.js';

if(!await bootstrapSharedWorkspace())await openWorkspace(async () => {
  const {hasKitchenSource,saveProject,storedKitchenProject} = await import('./kitchen-project.js');
  const {newVisitRequested,clearNewVisitRequest} = await import('./kitchen-project-switch.js');
  const {withDeviceCatalog} = await import('./kitchen-device-catalog.js');

  const entry = new URL(location.href);
  const requestedPanel = entry.searchParams.get('panel');
  if (requestedPanel === 'workshop' && entry.searchParams.get('step') === 'factorySetup') {
    entry.searchParams.set('step','factory');
    history.replaceState(history.state,'',entry.href);
  }
  const management = requestedPanel === 'defaults' || requestedPanel === 'libraries' || (requestedPanel === 'workshop' &&
    ['home','oversight','store','libraries','recipes','machines','sale','template','factory','team','inventory','sync','tracking','maintenance'].includes(entry.searchParams.get('step')));

  // A project that was put aside (new project, or another one opened) leaves the slot empty; ask for the intake form even if a shelf plan is stored.
  const intake = !management && (!hasKitchenSource() || (newVisitRequested() && !storedKitchenProject()));
  // The libraries of the device are read before the editor opens, so a screen that lists them never waits. A browser that cannot open
  // the database simply starts with the libraries the program ships.
  const startEditor = async () => {
    const {loadLibraries} = await import('./kitchen-library-store.js');
    await Promise.race([loadLibraries(), new Promise(resolve => setTimeout(resolve, 3000))]);
    await import('./kitchen-editor.js');
  };
  if (!intake) {
    await startEditor();
  } else {
    const {mountVisitStart} = await import('./kitchen-visit-start.js');
    mountVisitStart(async (opened, imported) => {
      if (storedKitchenProject()) throw Error('فُتح مشروع في نافذة أخرى. حدّث الصفحة لاستعادته.');
      // A new visit starts from the factory catalog set up on this device, so its items are priced from the first screen.
      const doc = imported ? opened : withDeviceCatalog(opened);
      if (!saveProject(doc)) throw Error('تعذّر حفظ المشروع في هذا المتصفح.');
      clearNewVisitRequest();
      if (!imported) {
        const {rememberKitchenViewport}=await import('./kitchen-viewport.js');
        rememberKitchenViewport({view:'top'});
      }
      if (!imported && !requestedPanel) {
        entry.searchParams.set('panel','workshop');
        entry.searchParams.set('step','survey');
        const polygon=doc.room.architecture?.outline?.vertices;
        if(polygon?.length&&polygon.every(v=>doc.room.workshop?.chains?.[v.id]?.rows.some(r=>r.kind==='stop'||r.kind==='corner'))) entry.searchParams.set('survey','review');
        history.replaceState(history.state,'',entry.href);
      }
      await startEditor();
    });
  }
});
