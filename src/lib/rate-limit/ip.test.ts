import { describe, expect, it } from "vitest";
import { clientIpFromHeaders, isPrivateIp } from "./ip";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHeaders(map: Record<string, string>) {
  return {
    get(name: string): string | null {
      return map[name.toLowerCase()] ?? null;
    },
  };
}

function withEnv(key: string, value: string | undefined, fn: () => void) {
  const original = process.env[key];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
  try {
    fn();
  } finally {
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
}

// ---------------------------------------------------------------------------
// isPrivateIp
// ---------------------------------------------------------------------------

describe("isPrivateIp", () => {
  it("identifies loopback IPv4", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
  });

  it("identifies 10.x private range", () => {
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("10.255.255.255")).toBe(true);
  });

  it("identifies 172.16-31 private range", () => {
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
    expect(isPrivateIp("172.15.0.1")).toBe(false);
    expect(isPrivateIp("172.32.0.1")).toBe(false);
  });

  it("identifies 192.168 private range", () => {
    expect(isPrivateIp("192.168.1.1")).toBe(true);
    expect(isPrivateIp("192.169.1.1")).toBe(false);
  });

  it("identifies IPv6 loopback", () => {
    expect(isPrivateIp("::1")).toBe(true);
  });

  it("identifies IPv6 unique-local", () => {
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("fd12:3456:789a::1")).toBe(true);
  });

  it("does not flag public IPs as private", () => {
    expect(isPrivateIp("1.2.3.4")).toBe(false);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("203.0.113.1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// clientIpFromHeaders — XFF spoofing / trusted-proxy hop count
// ---------------------------------------------------------------------------

describe("clientIpFromHeaders", () => {
  it("does NOT use the leftmost (spoofed) XFF value when TRUSTED_PROXY_HOPS=1", () => {
    // Attacker forges leftmost entry; LB appends real client (1.2.3.4) rightmost.
    // With hops=1, we pick the rightmost non-private entry — the real client.
    withEnv("TRUSTED_PROXY_HOPS", "1", () => {
      const headers = makeHeaders({
        "x-forwarded-for": "evil.0.0.1, 1.2.3.4",
      });
      const ip = clientIpFromHeaders(headers);
      expect(ip).toBe("1.2.3.4");
    });
  });

  it("respects TRUSTED_PROXY_HOPS=2 (two trusted proxies in chain)", () => {
    // [client, proxy1, lb] — lb wrote its view as the last; client is at idx len-2
    withEnv("TRUSTED_PROXY_HOPS", "2", () => {
      const headers = makeHeaders({
        "x-forwarded-for": "5.6.7.8, 10.0.0.1, 203.0.113.1",
      });
      // candidates after removing private: [5.6.7.8, 203.0.113.1]
      // idx = 2 - 2 = 0  → 5.6.7.8
      const ip = clientIpFromHeaders(headers);
      expect(ip).toBe("5.6.7.8");
    });
  });

  it("skips private IPs in the XFF chain", () => {
    withEnv("TRUSTED_PROXY_HOPS", "1", () => {
      const headers = makeHeaders({
        // private intermediary, then real client
        "x-forwarded-for": "9.9.9.9, 10.0.0.5, 203.0.113.50",
      });
      // non-private: [9.9.9.9, 203.0.113.50]
      // idx = 2 - 1 = 1 → 203.0.113.50
      const ip = clientIpFromHeaders(headers);
      expect(ip).toBe("203.0.113.50");
    });
  });

  it("prefers x-real-ip over x-forwarded-for when TRUSTED_PROXY_HOPS >= 1", () => {
    withEnv("TRUSTED_PROXY_HOPS", "1", () => {
      const headers = makeHeaders({
        "x-real-ip": "11.22.33.44",
        "x-forwarded-for": "5.5.5.5, 6.6.6.6",
      });
      expect(clientIpFromHeaders(headers)).toBe("11.22.33.44");
    });
  });

  it("prefers cf-connecting-ip over x-real-ip and x-forwarded-for", () => {
    withEnv("TRUSTED_PROXY_HOPS", "1", () => {
      const headers = makeHeaders({
        "cf-connecting-ip": "99.88.77.66",
        "x-real-ip": "11.22.33.44",
        "x-forwarded-for": "5.5.5.5, 6.6.6.6",
      });
      expect(clientIpFromHeaders(headers)).toBe("99.88.77.66");
    });
  });

  it("returns null when TRUSTED_PROXY_HOPS=0 (header trust disabled)", () => {
    withEnv("TRUSTED_PROXY_HOPS", "0", () => {
      const headers = makeHeaders({
        "cf-connecting-ip": "99.88.77.66",
        "x-forwarded-for": "5.5.5.5",
      });
      expect(clientIpFromHeaders(headers)).toBeNull();
    });
  });

  it("returns null when all XFF entries are private", () => {
    withEnv("TRUSTED_PROXY_HOPS", "1", () => {
      const headers = makeHeaders({
        "x-forwarded-for": "10.0.0.1, 192.168.1.1",
      });
      expect(clientIpFromHeaders(headers)).toBeNull();
    });
  });

  it("returns null when no relevant headers are present", () => {
    withEnv("TRUSTED_PROXY_HOPS", "1", () => {
      expect(clientIpFromHeaders(makeHeaders({}))).toBeNull();
    });
  });
});
