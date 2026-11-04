// Choose the working surface before loading a project. Once open, rotating,
// zooming, or resizing must never remount an editor with an unfinished measurement.
export async function openWorkspace(startEditor) {
  const tablet = window.matchMedia('(min-width: 768px)');
  const entry = new URL(location.href).searchParams;
  // The site notebook supports a phone viewport. Keep the existing width
  // gate for CAD and other workspaces, and decide only once before mounting.
  const survey = entry.get('panel') === 'workshop' && entry.get('step') === 'survey';
  if (tablet.matches || survey) {
    document.documentElement.dataset.workspaceOpen = '';
    return startEditor();
  }

  const notice = document.createElement('main');
  notice.className = 'studio-width-note';
  notice.innerHTML = `<section aria-labelledby="workspace-width-title">
    <img src="./studio-mark.svg" width="36" height="36" alt="">
    <p>استوديو المطابخ</p>
    <h1 id="workspace-width-title">مساحة الرسم مصمّمة للتابلت والكمبيوتر</h1>
    <p>وسّع النافذة لعرض الرسم والقياسات جنبًا إلى جنب، أو افتح اللوحة ومرّرها أفقيًا.</p>
    <button type="button">فتح مساحة العمل هنا</button>
  </section>`;
  document.body.prepend(notice);
  const useCurrentWindow = await new Promise(resolve => {
    const button = notice.querySelector('button');
    function finish(wide) {
      tablet.removeEventListener('change', onResize);
      button.removeEventListener('click', openHere);
      notice.remove();
      resolve(wide);
    }
    function onResize() { if (tablet.matches) finish(true); }
    function openHere() { finish(false); }
    tablet.addEventListener('change', onResize);
    button.addEventListener('click', openHere);
  });

  document.documentElement.dataset.workspaceOpen = '';
  if (useCurrentWindow) return startEditor();

  // A child viewport keeps ALL of the editor's width-dependent controls
  // consistent even in desktop split view, where viewport meta has no effect.
  const surface = document.createElement('main');
  surface.className = 'studio-scroll-sheet';
  surface.tabIndex = 0;
  surface.setAttribute('aria-label', 'مساحة التابلت، قابلة للتمرير أفقيًا');
  const editor = document.createElement('iframe');
  editor.title = 'مساحة عمل استوديو المطابخ';
  const target = new URL(location.href);
  target.searchParams.append('workspace', 'tablet');
  editor.src = target.href;
  surface.append(editor);
  document.body.replaceChildren(surface);
}
