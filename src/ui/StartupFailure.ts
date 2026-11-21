export function showStartupFailure(error: unknown) {
  const panel = document.createElement('section'); panel.id = 'startup-error'; panel.setAttribute('role', 'alert');
  const title = document.createElement('h1'); title.textContent = '无法启动 3D 城市';
  const description = document.createElement('p'); description.textContent = '请使用支持 WebGL2 的桌面浏览器并启用硬件加速，然后重新打开城市。';
  const detail = document.createElement('p'); detail.textContent = error instanceof Error ? error.message : '浏览器未能创建 3D 场景。'; detail.className = 'panel-note';
  const retry = document.createElement('button'); retry.className = 'primary'; retry.textContent = '重新尝试'; retry.onclick = () => location.reload();
  panel.append(title, description, detail, retry); document.getElementById('app')!.replaceChildren(panel);
}
