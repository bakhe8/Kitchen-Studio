import {openWorkspace} from './kitchen-workspace-entry.js';
import {bootstrapSharedWorkspace} from './kitchen-scoped-client.js';

if(!await bootstrapSharedWorkspace({unit:true}))await openWorkspace(async () => {
  const id = new URLSearchParams(location.search).get('unit');
  const {openUnitContext,openKitchenProject} = await import('./kitchen-project.js');
  const {refreshProjectAccess} = await import('./kitchen-project-access.js');
  const access=await refreshProjectAccess(openKitchenProject());
  if(!['owner','editor','rep'].includes(access.role)){location.replace('./?panel=workshop&step=home');return;}
  const context = id && openUnitContext(id);
  if (!context) {
    location.replace('./');
    return;
  }
  const {setUnitContext} = await import('./shelf-unit-state.js');
  setUnitContext(context);
  document.body.dataset.projectMode = 'kitchen-unit';
  await import('./shelf-planner.js');
});
