"use client";

import Link from "next/link";
import { Footer } from "../Footer";

interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  image: string;
}

const posts: BlogPost[] = [
  {
    slug: "introducing-cortex",
    title: "Introducing Cortex",
    description: "A local-first persistent memory layer for AI. Stop losing context every time the session, tool, or model changes.",
    date: "June 19, 2026",
    image: "",
  },
  {
    slug: "durable-memory",
    title: "Why Memory Should Be Durable",
    description: "Hidden context is a liability. Cortex makes memory inspectable, content-addressed, and consolidated over time — not a black box.",
    date: "June 19, 2026",
    image: "",
  },
];

export default function BlogPage(): React.JSX.Element {
  return (
    <>
      <article className="article">
        <header>
          <h1>Blog</h1>
          <p className="tagline">Announcements and updates</p>
        </header>

        <section>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "0.5rem" }}>
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="blog-post-card"
              >
                <div
                  style={{
                    aspectRatio: "3600 / 1890",
                    background: "var(--surface2)",
                    overflow: "hidden",
                  }}
                >
                  {post.image && (
                    <img
                      src={post.image}
                      alt={post.title}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  )}
                </div>
                <div style={{ padding: "1rem 1.25rem", background: "var(--surface)" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginTop: "0.25rem",
                      marginBottom: "0.375rem",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: "0.9375rem",
                        fontWeight: 500,
                        color: "var(--ink)",
                        margin: 0,
                      }}
                    >
                      {post.title}
                    </h3>
                    <span style={{ color: "var(--faint)" }}>•</span>
                    <time
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 300,
                        color: "var(--muted)",
                      }}
                    >
                      {post.date}
                    </time>
                  </div>
                  <p
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--muted)",
                      lineHeight: 1.45,
                      margin: 0,
                    }}
                  >
                    {post.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </article>

      <Footer />
    </>
  );
}
