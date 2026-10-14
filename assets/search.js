(async () => {
  const form = document.querySelector('#filters');
  const results = document.querySelector('#results');
  const count = document.querySelector('#count');
  const fields = ['query', 'topic', 'from', 'to'].map(id => document.getElementById(id));
  const [query, topic, from, to] = fields;
  const params = new URLSearchParams(location.search);
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  };
  try {
    const response = await fetch(document.querySelector('.archive').dataset.index);
    if (!response.ok) throw new Error('Archive unavailable');
    const sessions = await response.json();
    const topics = [...new Set(sessions.flatMap(s => s.topics || []))].sort((a, b) => a.localeCompare(b));
    topics.forEach(value => topic.add(new Option(value, value)));
    fields.forEach(field => { field.value = params.get(field.id) || ''; });
    function render() {
      const terms = query.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const invalidRange = from.value && to.value && from.value > to.value;
      const matches = sessions.filter(s => !invalidRange &&
        (!from.value || s.date >= from.value) && (!to.value || s.date <= to.value) &&
        (!topic.value || (s.topics || []).includes(topic.value)) &&
        terms.every(term => [s.title, s.repository, s.summary, s.content, ...(s.topics || [])].join(' ').toLocaleLowerCase().includes(term)));
      const state = new URLSearchParams();
      fields.forEach(field => { if (field.value) state.set(field.id, field.value); });
      history.replaceState(null, '', location.pathname + (state.size ? '?' + state : '') + location.hash);
      count.textContent = `${matches.length} ${matches.length === 1 ? 'session' : 'sessions'}`;
      results.replaceChildren();
      if (!matches.length) results.append(make('p', 'empty', invalidRange ? 'Choose a start date on or before the end date.' : sessions.length ? 'No sessions match these filters. Try a different keyword or date range.' : 'Your archive starts here. Add a Markdown session to the _sessions folder to publish your first review.'));
      matches.forEach(s => {
        const card = make('article', 'card', '');
        const meta = make('p', 'eyebrow', s.date + (s.repository ? ' · ' + s.repository : ''));
        const heading = make('h3', '', '');
        const link = make('a', '', s.title); link.href = s.url; heading.append(link);
        const tags = make('div', 'tags', '');
        (s.topics || []).forEach(value => {
          const button = make('button', 'tag', value); button.type = 'button';
          button.addEventListener('click', () => { topic.value = value; render(); }); tags.append(button);
        });
        card.append(meta, heading, make('p', 'summary', s.summary), tags);
        results.append(card);
      });
    }
    form.addEventListener('submit', event => event.preventDefault());
    form.addEventListener('input', render);
    form.addEventListener('reset', () => setTimeout(render, 0));
    render();
  } catch (error) {
    count.textContent = 'Unable to load sessions.';
    results.append(make('p', 'empty', 'Please reload the page to try again.'));
  }
})();
