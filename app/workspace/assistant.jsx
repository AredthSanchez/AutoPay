/**
 * Read-only chat panel scoped to the selected business. Sends conversation text to the server,
 * which chooses testing or OpenAI mode and builds the authorized record snapshot.
 */
"use client";
import React, { useEffect, useRef, useState } from "react";
import { Sparkles, Send, RotateCcw, LoaderCircle } from "lucide-react";
import { request } from "./api";
export default function Assistant({ business }) {
  const [messages, setMessages] = useState([]),
    [prompt, setPrompt] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [setup, setSetup] = useState(null);
  const bottom = useRef(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    request("/chat")
      .then(setSetup)
      .catch((e) => setError(e.message));
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (messages.length || busy) bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages, busy]);
  // Send conversation context, not raw bank records or attachments; the server assembles allowed data.
  async function send(value = prompt) {
    const content = value.trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setPrompt("");
    setError("");
    setBusy(true);
    try {
      const result = await request("/chat", { messages: next.slice(-9) });
      if (alive.current)
        setMessages([...next, { role: "assistant", content: result.answer, asOf: result.asOf }]);
    } catch (e) {
      if (alive.current) {
        setError(e.message);
        setMessages(messages);
        setPrompt(content);
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section className="assistant-panel panel" aria-label="AutoPay Assistant">
      <div className="assistant-head">
        <div className="assistant-symbol">
          <Sparkles size={22} />
        </div>
        <div>
          <h2>Ask your workspace.</h2>
          <p>Invoice and client summaries for {business.name}</p>
        </div>
        <button
          className="secondary"
          disabled={busy || !messages.length}
          onClick={() => {
            setMessages([]);
            setError("");
            setPrompt("");
          }}
        >
          <RotateCcw size={14} />
          New chat
        </button>
      </div>
      {setup?.mode === "testing" && (
        <div className="assistant-setup assistant-testing" role="status">
          <b>Free testing mode</b>
          <p>
            Get calculated summaries of your invoices and clients. This rule-based assistant makes
            no OpenAI requests and incurs no OpenAI API charges. It supports common report
            questions, rather than general AI conversation.
          </p>
        </div>
      )}
      {setup && !setup.configured && (
        <div className="assistant-setup" role="status">
          <b>One connection away</b>
          <p>
            AI summaries are ready to connect. The site owner needs to add the OPENAI_API_KEY server
            secret using OpenAI Developers, then publish the updated runtime configuration. Never
            paste an API key into this chat.
          </p>
        </div>
      )}
      <div className="assistant-messages" role="log" aria-label="Conversation" aria-live="polite">
        {!messages.length && (
          <div className="assistant-welcome">
            <Sparkles size={30} />
            <h3>A clearer picture, just ask.</h3>
            <p>Try a suggested question or ask about a client, invoice, or overdue balance.</p>
            <div className="assistant-suggestions">
              {[
                "Summarize my invoices and outstanding balance.",
                "Which invoices are overdue?",
                "Give me a summary of my clients.",
                "Which clients have the highest unpaid balances?",
              ].map((s) => (
                <button
                  className="secondary"
                  key={s}
                  disabled={busy || setup?.configured === false}
                  onClick={() => send(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div className={"assistant-message " + m.role} key={i}>
            <span className="assistant-speaker">
              {m.role === "user" ? "You" : "AutoPay Assistant"}
            </span>
            <div>{m.content}</div>
            {m.asOf && <small>Workspace snapshot · {m.asOf} UTC</small>}
          </div>
        ))}
        {busy && (
          <div className="assistant-thinking" role="status">
            <LoaderCircle size={16} />
            Reading your workspace…
          </div>
        )}
        <div ref={bottom} />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <form
        className="assistant-compose"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label className="sr-only" htmlFor="assistant-question">
          Ask about invoices or clients
        </label>
        <textarea
          id="assistant-question"
          value={prompt}
          maxLength={4000}
          rows={2}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask about invoices or clients…"
          disabled={busy || setup?.configured === false}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          className="primary"
          aria-label="Send question"
          disabled={busy || !prompt.trim() || setup?.configured === false}
        >
          <Send size={17} />
        </button>
      </form>
      <p className="assistant-footnote">
        Read-only · Uses this business’s current records · Bank fields, notes, and files are
        excluded.{" "}
        {setup?.mode === "testing"
          ? "Questions are processed inside AutoPay; nothing is sent to OpenAI."
          : "Questions and selected invoice/client data are sent to OpenAI."}{" "}
        Verify important figures against your invoices. Chat history clears when you leave this
        workspace.
      </p>
    </section>
  );
}
