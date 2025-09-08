/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Chat } from '@google/genai';

const promptForm = document.getElementById('prompt-form') as HTMLFormElement;
const promptInput = document.getElementById('prompt-input') as HTMLInputElement;
const messagesContainer = document.getElementById('messages') as HTMLElement;
const app = document.getElementById('app') as HTMLElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const filePreviewContainer = document.getElementById('file-preview-container') as HTMLElement;

// Show a loading indicator in the app.
const showLoading = () => {
  app.classList.add('loading');
  promptInput.disabled = true;
};

// Hide the loading indicator from the app.
const hideLoading = () => {
  app.classList.remove('loading');
  promptInput.disabled = false;
  promptInput.focus();
};

/**
 * A class to manage the chat state and interactions with the Gemini API.
 */
class AIChat {
  private chat: Chat;
  private attachedFile: { mimeType: string; data: string; name: string; } | null = null;

  constructor() {
    if (!process.env.API_KEY) {
      this.renderError('API_KEY environment variable not set.');
      return;
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    this.chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: 'You are a friendly and expert AI tutor from riteshacademy, specializing in Power BI, SQL, Python for data analysis, Machine Learning, and Advanced Excel. When a user uploads a file (like a CSV or Excel), analyze its structure (columns, sample data) to provide context-aware help, such as generating complex formulas, writing scripts, or explaining concepts relevant to the data. Explain concepts clearly and concisely, as if you are teaching a beginner. Use analogies and simple examples. Format your responses using markdown.',
      },
    });
    this.initialize();
  }

  /**
   * Initializes the chat by sending a welcome message and setting up event listeners.
   */
  private initialize() {
    this.renderMessage("Hello! I'm your AI Tutor from riteshacademy. Ask me anything about Power BI, SQL, Python, ML, and Advanced Excel. You can also attach a CSV or Excel file!", 'ai');
    fileInput.addEventListener('change', this.handleFileChange.bind(this));
  }

  /**
   * Handles the file input change event.
   */
  private handleFileChange() {
    const file = fileInput.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // data:mime/type;base64,DATA
      const base64Data = dataUrl.substring(dataUrl.indexOf(',') + 1);
      this.attachedFile = {
        name: file.name,
        mimeType: file.type,
        data: base64Data,
      };
      this.renderFilePreview();
    };
    reader.readAsDataURL(file);
  }

  /**
   * Renders a preview of the attached file.
   */
  private renderFilePreview() {
    if (!this.attachedFile) return;
    filePreviewContainer.innerHTML = `
      <div class="file-preview">
        <span>${this.attachedFile.name}</span>
        <button class="remove-file-btn" aria-label="Remove file">&times;</button>
      </div>
    `;
    filePreviewContainer.querySelector('.remove-file-btn')?.addEventListener('click', this.removeFile.bind(this));
  }

  /**
   * Removes the attached file and its preview.
   */
  private removeFile() {
    this.attachedFile = null;
    fileInput.value = ''; // Reset the file input
    filePreviewContainer.innerHTML = '';
  }

  /**
   * Renders a message in the chat window.
   * @param message The message to render.
   * @param sender The sender of the message ('user' or 'ai').
   * @returns The HTML element of the newly created message.
   */
  private renderMessage(message: string, sender: 'user' | 'ai'): HTMLElement {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `${sender}-message`);

    // Basic markdown-to-HTML conversion
    let htmlContent = message
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italics
      .replace(/`([^`]+)`/g, '<code>$1</code>') // Inline code
      .replace(/(\r\n|\n|\r)/gm, '<br>'); // Newlines

    messageElement.innerHTML = htmlContent;
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return messageElement;
  }
  
  /**
   * Renders an error message in the chat window.
   * @param message The error message to display.
   */
  private renderError(message: string) {
      const errorElement = document.createElement('div');
      errorElement.classList.add('message', 'error-message');
      errorElement.textContent = `Error: ${message}`;
      messagesContainer.appendChild(errorElement);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      hideLoading();
  }

  /**
   * Sends a message to the AI and streams the response.
   * @param message The message to send.
   */
  async sendMessage(message: string) {
    if (!message.trim() && !this.attachedFile) return;
    if (!message.trim() && this.attachedFile) {
      message = `Analyze this file: ${this.attachedFile.name}`;
    }

    showLoading();
    this.renderMessage(message, 'user');
    promptInput.value = '';

    const contents = [];
    if (this.attachedFile) {
      contents.push({
        inlineData: {
          mimeType: this.attachedFile.mimeType,
          data: this.attachedFile.data,
        },
      });
    }
    contents.push({ text: message });
    
    // Clear the file after preparing it for sending
    this.removeFile();

    try {
      // FIX: The `sendMessageStream` method expects a `message` property containing the parts, not a `contents` property.
      const responseStream = await this.chat.sendMessageStream({ message: contents });

      let aiMessageElement: HTMLElement | null = null;
      let buffer = '';

      for await (const chunk of responseStream) {
        buffer += chunk.text;
        if (!aiMessageElement) {
          aiMessageElement = this.renderMessage('...', 'ai');
        }
        // Basic markdown-to-HTML conversion
        let htmlContent = buffer
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/`([^`]+)`/g, '<code>$1</code>')
          .replace(/(\r\n|\n|\r)/gm, '<br>');

        if (aiMessageElement) {
            aiMessageElement.innerHTML = htmlContent;
        }
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    } catch (error) {
      this.renderError(error instanceof Error ? error.message : 'An unknown error occurred.');
    } finally {
      hideLoading();
    }
  }
}

const aiChat = new AIChat();

promptForm.addEventListener('submit', (e) => {
  e.preventDefault();
  aiChat.sendMessage(promptInput.value);
});
