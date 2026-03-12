// eslint-disable-next-line no-unused-vars
function buildCssSelector(el) {
  if (el.id) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  if (el.name) return `${tag}[name="${el.name}"]`;
  if (el.classList.length) return `${tag}.${el.classList[0]}`;
  return tag;
}
