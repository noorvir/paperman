import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import type { ScanBatch, Tag } from "@paperman/api";

import { api } from "./api";

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function App() {
  const [scans, setScans] = useState<readonly ScanBatch[]>([]);
  const [tags, setTags] = useState<readonly Tag[]>([]);
  const [tagName, setTagName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [nextScans, nextTags] = await Promise.all([
        api.inbox.list(),
        api.tags.list(),
      ]);
      setScans(nextScans);
      setTags(nextTags);
      setError("");
    } catch {
      setError(
        "PaperMan could not read the inbox. Check that the server is running.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function createTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = tagName.trim();
    if (!name) {
      return;
    }
    setSaving(true);
    try {
      await api.tags.create({ name });
      setTagName("");
      await refresh();
    } catch {
      setError("Could not add this tag. Check if it already exists.");
    } finally {
      setSaving(false);
    }
  }

  async function removeTag(tag: Tag) {
    try {
      await api.tags.remove({ id: tag.id });
      await refresh();
    } catch {
      setError(`Could not remove ${tag.name}.`);
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">▤</span> PaperMan
        </div>
        <nav aria-label="Main navigation">
          <a className="nav-link active" href="#inbox">
            Inbox <span>{scans.length}</span>
          </a>
          <a className="nav-link" href="#tags">
            Tags
          </a>
          <a className="nav-link" href="#pipeline">
            Pipeline
          </a>
        </nav>
        <div className="sidebar-foot">
          <span className="status-dot" /> Local document workspace
        </div>
      </aside>

      <main>
        <header className="topbar">
          <span>DOCUMENT WORKSPACE</span>
          <span className="topbar-right">
            <span className="status-dot" /> Inbox on disk
          </span>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">OVERVIEW</p>
              <h1>Scans, in one place.</h1>
              <p className="intro">
                New PDF scan batches appear here. Each original stays in the
                inbox until the document pipeline is ready.
              </p>
            </div>
            <button
              className="secondary"
              type="button"
              onClick={() => void refresh()}
            >
              Refresh inbox
            </button>
          </div>

          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}

          <section className="stats" aria-label="Workspace status">
            <div className="stat">
              <span>SCAN BATCHES</span>
              <strong>{scans.length}</strong>
              <small>Original PDF files</small>
            </div>
            <div className="stat">
              <span>AVAILABLE TAGS</span>
              <strong>{tags.length}</strong>
              <small>Ready for classification</small>
            </div>
            <div className="stat">
              <span>PIPELINE</span>
              <strong className="stat-word">Not active</strong>
              <small>Split and AI steps come next</small>
            </div>
          </section>

          <section className="panel" id="inbox">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">01 / INTAKE</p>
                <h2>Scan inbox</h2>
              </div>
              <span className="count">{scans.length} files</span>
            </div>
            {loading ? (
              <p className="empty">Reading the inbox</p>
            ) : scans.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">▤</div>
                <strong>No scans yet</strong>
                <p>
                  PDF files placed in the inbox will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="scan-list">
                {scans.map((scan) => (
                  <div className="scan-row" key={scan.name}>
                    <div className="pdf-icon">PDF</div>
                    <div className="scan-info">
                      <strong>{scan.name}</strong>
                      <span>{formatDate(scan.modifiedAt)}</span>
                    </div>
                    <span className="scan-size">
                      {formatSize(scan.sizeBytes)}
                    </span>
                    <span className="pill">New scan</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel" id="tags">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">02 / ORGANIZE</p>
                <h2>Tag catalog</h2>
              </div>
            </div>
            <p className="section-copy">
              Define labels now. The future pipeline will assign them to
              separate documents.
            </p>
            <form
              className="tag-form"
              onSubmit={(event) => void createTag(event)}
            >
              <label className="sr-only" htmlFor="tag-name">
                New tag name
              </label>
              <input
                id="tag-name"
                maxLength={60}
                placeholder="New tag name, such as Insurance"
                value={tagName}
                onChange={(event) => setTagName(event.target.value)}
              />
              <button type="submit" disabled={saving || !tagName.trim()}>
                Add tag
              </button>
            </form>
            <div className="tag-list">
              {tags.length === 0 ? (
                <p className="tag-empty">No tags defined yet.</p>
              ) : (
                tags.map((tag) => (
                  <div className="tag-row" key={tag.id}>
                    <span className="tag-chip">{tag.name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${tag.name}`}
                      onClick={() => void removeTag(tag)}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="pipeline" id="pipeline">
            <div>
              <p className="eyebrow">03 / COMING NEXT</p>
              <h2>From batch to document</h2>
              <p>
                OCR, logical splitting, AI classification, review, and filing
                will connect to this inbox. No scan is processed yet.
              </p>
            </div>
            <div className="pipeline-steps">
              <span>SCAN</span>
              <i>→</i>
              <span>SPLIT</span>
              <i>→</i>
              <span>TAG</span>
              <i>→</i>
              <span>FILE</span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
