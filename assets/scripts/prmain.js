    // ── Configuration ──
    const WORKER_URL = 'https://api.prev.devtem.org'; // Replace with your worker URL

    // ── DOM refs ──
    const $ = id => document.getElementById(id);
    const frame = $('preview-frame');
    const wrap = $('frame-wrap');
    const overlay = $('state-overlay');
    const stateMsg = $('state-msg');
    const progressFill = $('progress-fill');
    const noPreview = $('no-preview');
    const readmePanel = $('readme-panel');
    const previewTitle = $('preview-title');
    const buyBtn = $('buy-btn');
    const noPreviewBuy = $('no-preview-buy');
    const backLink = $('back-link');

    function setMsg(html) { stateMsg.innerHTML = html; }
    function setProgress(pct) { progressFill.style.width = Math.min(pct, 100) + '%'; }

    function showError(msg, postId) {
      document.querySelector('.state-spinner').style.display = 'none';
      $('progress-bar').style.display = 'none';
      setMsg(postId ? msg + `<br><br><a href="/p?id=${postId}">View product page →</a>` : msg);
    }

    function showNoPreviewUI(postId) {
      overlay.classList.add('hidden');
      frame.style.display = 'none';
      readmePanel.classList.remove('visible');
      noPreview.classList.add('visible');
      if (postId) noPreviewBuy.href = `/p?id=${postId}`;
    }

    function mountHTML(html) {
      overlay.classList.add('hidden');
      noPreview.classList.remove('visible');
      frame.style.display = '';
      frame.srcdoc = html;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('.tab-btn[data-tab="preview"]').classList.add('active');
      readmePanel.classList.remove('visible');
    }

    function renderReadme(content, isMarkdown) {
      readmePanel.classList.add('visible');
      if (!content) {
        readmePanel.innerHTML = `
          <div class="readme-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
            <p>No README file found in this template.</p>
          </div>
        `;
        return;
      }

      let html;
      if (isMarkdown) {
        html = markdownToHtml(content);
      } else {
        html = `<pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;line-height:1.8;">${escapeHtml(content)}</pre>`;
      }
      readmePanel.innerHTML = html;
    }

    // ── Simple Markdown renderer (same as before) ──
    function markdownToHtml(md) {
      let html = md;
      html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
      html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
      html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
      html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
      html = html.replace(/_(.+?)_/g, '<em>$1</em>');
      html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
      html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
      html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
      html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
      html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
      html = html.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');
      html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
      html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
      html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ol>$&</ol>');

      const lines = html.split('\n');
      let inList = false;
      let result = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) { if (!inList) result.push(''); continue; }
        if (trimmed.startsWith('<li>') || trimmed.startsWith('</li>') || trimmed.startsWith('<ul>') || trimmed.startsWith('</ul>') || trimmed.startsWith('<ol>') || trimmed.startsWith('</ol>')) {
          inList = true;
          result.push(line);
          continue;
        }
        if (trimmed.startsWith('<h') || trimmed.startsWith('</h') || trimmed.startsWith('<blockquote>') || trimmed.startsWith('</blockquote>') || trimmed.startsWith('<pre>') || trimmed.startsWith('</pre>')) {
          inList = false;
          result.push(line);
          continue;
        }
        if (inList && (trimmed.startsWith('<li>') || trimmed.startsWith('</li>'))) {
          result.push(line);
          continue;
        }
        inList = false;
        if (!trimmed.startsWith('<')) {
          result.push(`<p>${trimmed}</p>`);
        } else {
          result.push(line);
        }
      }
      html = result.join('\n');
      html = html.replace(/<p><\/p>/g, '');
      html = html.replace(/^---$/gm, '<hr>');
      return html;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // ── Viewport toggle ──
    document.querySelectorAll('.vp-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.vp-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        wrap.className = btn.dataset.vp;
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab && activeTab.dataset.tab === 'preview') {
          frame.style.display = '';
          readmePanel.classList.remove('visible');
          noPreview.classList.remove('visible');
        }
      });
    });

    // ── Tab switching ──
    let readmeCache = null;

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;

        if (tab === 'preview') {
          frame.style.display = '';
          readmePanel.classList.remove('visible');
          noPreview.classList.remove('visible');
        } else { // readme
          frame.style.display = 'none';
          noPreview.classList.remove('visible');
          readmePanel.classList.add('visible');

          if (!readmeCache) {
            setMsg('Loading README…');
            setProgress(0);
            try {
              const resp = await fetch(`${WORKER_URL}/readme?id=${postId}`);
              const data = await resp.json();
              if (data.error) {
                renderReadme(null);
              } else {
                readmeCache = data;
                renderReadme(data.content, data.isMarkdown);
              }
            } catch (err) {
              renderReadme(null);
            }
            setProgress(100);
            setMsg('');
          } else {
            renderReadme(readmeCache.content, readmeCache.isMarkdown);
          }
        }
      });
    });

    // ── Main ──
    const params = new URLSearchParams(location.search);
    const postId = params.get('id');

    if (!postId) {
      showError('<b>No product ID</b> — go back and try again.');
    } else {
      loadPreview(postId);
    }

    async function loadPreview(id) {
      try {
        setMsg('Fetching product info…');
        setProgress(10);

        // 1. Get product info
        const infoResp = await fetch(`${WORKER_URL}/info?id=${id}`);
        const info = await infoResp.json();

        if (info.error) {
          showError(`<b>${info.error}</b>`);
          return;
        }

        previewTitle.textContent = info.name || 'Template Preview';
        buyBtn.href = `/p?id=${id}`;
        noPreviewBuy.href = `/p?id=${id}`;
        backLink.href = `/p?id=${id}`;
        document.title = `Preview — ${info.name || 'Template'} | DevTemple`;

        setMsg('Loading preview…');
        setProgress(30);

        // 2. Get preview HTML
        const previewResp = await fetch(`${WORKER_URL}/preview?id=${id}`);
        const previewData = await previewResp.json();

        if (previewData.error) {
          showNoPreviewUI(id);
          return;
        }

        setProgress(100);
        mountHTML(previewData.html);

        // Pre-fetch README in background
        fetch(`${WORKER_URL}/readme?id=${id}`)
          .then(r => r.json())
          .then(data => {
            if (!data.error) {
              readmeCache = data;
            }
          })
          .catch(() => {});

      } catch (err) {
        console.error('Preview error:', err);
        showError(`<b>Preview failed.</b><br><small>${err.message}</small>`);
      }
    }

    // Ensure preview tab is active
    document.querySelector('.tab-btn[data-tab="preview"]')?.classList.add('active');
