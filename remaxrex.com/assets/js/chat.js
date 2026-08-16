/**
 * RE/MAX Rex chat widget — calls the Cloudflare Worker chat API.
 *
 * Configure endpoint before deploy:
 *   window.REMAXREX_CHAT_CONFIG = { endpoint: 'https://your-worker.workers.dev/api/chat' };
 */
(function () {
  'use strict';

  var DEFAULT_CONFIG = {
    endpoint: '',
    maxMessageLength: 500,
    suggestedQuestions: [
      'What is the best way to start my home search?'
    ]
  };

  function getConfig() {
    return Object.assign({}, DEFAULT_CONFIG, window.REMAXREX_CHAT_CONFIG || {});
  }

  function createElement(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  function parseMarkdown(text) {
    // Basic markdown parsing - escape HTML first for security
    var html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Bold: **text**
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Italic: *text*
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Code: `text`
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Links: [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      // Newlines to <br>
      .replace(/\n/g, '<br>');
    return html;
  }

  function RemaxRexChatWidget(config) {
    this.config = config;
    this.isOpen = false;
    this.isLoading = false;
    this.messages = [];
    this.mount();
  }

  RemaxRexChatWidget.prototype.mount = function () {
    this.root = createElement('div', 'remaxrex-chat');
    this.root.innerHTML =
      '<button type="button" class="remaxrex-chat-toggle" aria-label="Open chat" aria-expanded="false">' +
        '<span class="remaxrex-chat-toggle-icon" aria-hidden="true">💬</span>' +
        '<span class="remaxrex-chat-toggle-label">Ask about RE/MAX Rex</span>' +
      '</button>' +
      '<div class="remaxrex-chat-panel" role="dialog" aria-label="RE/MAX Rex assistant" hidden>' +
        '<header class="remaxrex-chat-header">' +
          '<div><strong>RE/MAX Rex Assistant</strong><p>Ask about our services, agents, and how to start your home search.</p></div>' +
          '<button type="button" class="remaxrex-chat-close" aria-label="Close chat">&times;</button>' +
        '</header>' +
        '<div class="remaxrex-chat-messages" aria-live="polite"></div>' +
        '<div class="remaxrex-chat-thinking" hidden><span class="remaxrex-chat-thinking-dot"></span><span class="remaxrex-chat-thinking-dot"></span><span class="remaxrex-chat-thinking-dot"></span></div>' +
        '<div class="remaxrex-chat-suggestions"></div>' +
        '<form class="remaxrex-chat-form">' +
          '<input type="text" class="remaxrex-chat-input" placeholder="Ask a question..." maxlength="' + this.config.maxMessageLength + '" autocomplete="off" />' +
          '<button type="submit" class="remaxrex-chat-send">Send</button>' +
        '</form>' +
      '</div>';

    document.body.appendChild(this.root);

    this.panel = this.root.querySelector('.remaxrex-chat-panel');
    this.messagesEl = this.root.querySelector('.remaxrex-chat-messages');
    this.thinkingEl = this.root.querySelector('.remaxrex-chat-thinking');
    this.suggestionsEl = this.root.querySelector('.remaxrex-chat-suggestions');
    this.form = this.root.querySelector('.remaxrex-chat-form');
    this.input = this.root.querySelector('.remaxrex-chat-input');
    this.toggleBtn = this.root.querySelector('.remaxrex-chat-toggle');
    this.closeBtn = this.root.querySelector('.remaxrex-chat-close');
    this.sendBtn = this.root.querySelector('.remaxrex-chat-send');

    this.toggleBtn.addEventListener('click', this.toggle.bind(this));
    this.closeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    }.bind(this));
    this.form.addEventListener('submit', this.onSubmit.bind(this));

    this.renderSuggestions();
    this.addMessage('assistant', 'Hi! I can help you with information about RE/MAX Rex services, our agents, and how to start your home search.');
  };

  RemaxRexChatWidget.prototype.renderSuggestions = function () {
    var self = this;
    this.suggestionsEl.innerHTML = '';
    this.config.suggestedQuestions.forEach(function (question) {
      var btn = createElement('button', 'remaxrex-chat-suggestion', question);
      btn.type = 'button';
      btn.addEventListener('click', function () {
        self.input.value = question;
        self.suggestionsEl.style.display = 'none';
        self.form.requestSubmit();
      });
      self.suggestionsEl.appendChild(btn);
    });
  };

  RemaxRexChatWidget.prototype.toggle = function () {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  };

  RemaxRexChatWidget.prototype.open = function () {
    this.isOpen = true;
    this.panel.hidden = false;
    this.panel.style.display = 'flex';
    this.toggleBtn.setAttribute('aria-expanded', 'true');
    this.input.focus();
  };

  RemaxRexChatWidget.prototype.close = function () {
    this.isOpen = false;
    this.panel.hidden = true;
    this.panel.style.display = 'none';
    this.toggleBtn.setAttribute('aria-expanded', 'false');
  };

  RemaxRexChatWidget.prototype.addMessage = function (role, content) {
    this.messages.push({ role: role, content: content });
    var bubble = createElement('div', 'remaxrex-chat-message remaxrex-chat-message-' + role);
    // Use innerHTML with parsed markdown for assistant messages
    if (role === 'assistant') {
      bubble.innerHTML = parseMarkdown(content);
    } else {
      bubble.textContent = content;
    }
    this.messagesEl.appendChild(bubble);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  };

  RemaxRexChatWidget.prototype.setLoading = function (loading) {
    this.isLoading = loading;
    this.sendBtn.disabled = loading;
    this.input.disabled = loading;
    this.thinkingEl.hidden = !loading;
  };

  RemaxRexChatWidget.prototype.onSubmit = function (event) {
    event.preventDefault();
    if (this.isLoading) return;

    var message = this.input.value.trim();
    if (!message) return;

    this.input.value = '';
    this.addMessage('user', message);
    this.setLoading(true);

    var self = this;

    if (!this.config.endpoint || this.config.endpoint.includes('<YOUR_SUBDOMAIN>')) {
      setTimeout(function () {
        self.addMessage('assistant', 'The chat backend is not configured yet. Please contact our office at 1-561 220 1520 or email info@remaxrex.com for assistance.');
        self.setLoading(false);
      }, 500);
      return;
    }

    fetch(this.config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message })
    })
      .then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) {
            throw new Error(data.error || 'Request failed');
          }
          return data;
        });
      })
      .then(function (data) {
        self.addMessage('assistant', data.answer || 'No response received.');
      })
      .catch(function (error) {
        self.addMessage('assistant', 'Sorry, I could not reach the assistant right now. ' + error.message);
      })
      .finally(function () {
        self.setLoading(false);
      });
  };

  document.addEventListener('DOMContentLoaded', function () {
    new RemaxRexChatWidget(getConfig());
  });
})();
