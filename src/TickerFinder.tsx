import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useState, type FormEvent } from "react";
import { Switch } from "./components/ui/switch";

interface CompanyResult {
  symbol: string;
  name: string;
  currency: string;
  exchangeFullName: string;
  exchange: string;
}

interface SearchResult {
  query: string;
  result: CompanyResult | null;
  error?: string;
}

const isDev = import.meta.env?.DEV ?? false;

const mockData: Record<string, CompanyResult[]> = {
  default: [
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      currency: "USD",
      exchangeFullName: "NASDAQ Global Select",
      exchange: "NASDAQ",
    },
  ],
};

async function fetchTickerData(
  query: string,
  apiKey: string,
): Promise<CompanyResult[]> {
  const url = `https://financialmodelingprep.com/stable/search-name?query=${encodeURIComponent(query)}&apikey=${encodeURIComponent(apiKey)}`;

  if (isDev) {
    console.log(`[DEV] Mock API request: ${url}`);
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Generate mock response based on query
    const mockResult: CompanyResult = {
      symbol: query.substring(0, 4).toUpperCase().replace(/\s/g, ""),
      name: query,
      currency: "USD",
      exchangeFullName: "NASDAQ Global Select",
      exchange: "NASDAQ",
    };

    console.log(`[DEV] Mock response for "${query}":`, [mockResult]);
    return [mockResult];
  }

  const response = await fetch(url);

  if (response.status === 429) {
    return [
      {
        symbol: "TOO MANY REQUESTS",
        name: "",
        currency: "",
        exchangeFullName: "",
        exchange: "",
      },
    ];
  }

  return response.json();
}

export function TickerFinder() {
  const [csvOutput, setCsvOutput] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [usOnly, setUsOnly] = useState(true);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setCsvOutput("");
    setProgress("");
    setCopied(false);

    const formData = new FormData(e.currentTarget);
    const companiesRaw = formData.get("companies") as string;
    const apiKey = formData.get("apiKey") as string;

    const companyNames = companiesRaw
      .split("\n")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    if (companyNames.length === 0) {
      setCsvOutput("Error: No company names provided");
      setIsLoading(false);
      return;
    }

    const results: SearchResult[] = [];

    for (const query of companyNames) {
      setProgress(
        `Searching ${results.length + 1}/${companyNames.length}: ${query}`,
      );

      try {
        const data = await fetchTickerData(query, apiKey);
        const usOnlyData = data.filter((item) => item.currency === "USD");

        if (Array.isArray(data) && data.length > 0) {
          if (usOnly) {
            const result = usOnlyData[0] ?? null;
            results.push({ query, result });
          } else {
            const result = data[0] ?? null;
            results.push({ query, result });
          }
        } else {
          results.push({ query, result: null, error: "No results found" });
        }
      } catch (error) {
        results.push({ query, result: null, error: String(error) });
      }

      // Small delay to avoid rate limiting (skip in dev mode)
      if (!isDev && results.length < companyNames.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    // Generate TSV
    const headers = [
      "query",
      "symbol",
      "name",
      "currency",
      "exchangeFullName",
      "exchange",
      "error",
    ];
    const tsvRows = [headers.join("\t")];

    for (const { query, result, error } of results) {
      const row = [
        query,
        result?.symbol ?? "",
        result?.name ?? "",
        result?.currency ?? "",
        result?.exchangeFullName ?? "",
        result?.exchange ?? "",
        error ?? "",
      ];
      tsvRows.push(row.join("\t"));
    }

    setCsvOutput(tsvRows.join("\n"));
    setProgress(
      `Complete! Found tickers for ${companyNames.length} companies.`,
    );
    setIsLoading(false);
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(csvOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 pt-8 pb-4">
          {isDev && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-xs font-medium mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Dev Mode — Using Mock Data
            </div>
          )}
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            Ticker Finder
          </h1>
          <p className="text-muted-foreground">
            Convert company names to stock ticker symbols using Financial
            Modeling Prep API
          </p>
        </div>

        {/* Main Card */}
        <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Search Companies</CardTitle>
            <CardDescription>
              Paste company names from Excel (one per line) and get their ticker
              symbols
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* API Key Input */}
              <div className="space-y-2">
                <Label htmlFor="usOnly" className="flex items-center space-x-2">
                  U.S. Only
                </Label>
                <Switch
                  id="usOnly"
                  checked={usOnly}
                  onCheckedChange={(checked) => setUsOnly(checked === true)}
                />
                <Label htmlFor="apiKey" className="text-sm font-medium">
                  FMP API Key
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  name="apiKey"
                  placeholder="Enter your financialmodelingprep.com API key"
                  required
                  className="h-11 bg-white dark:bg-slate-800"
                />
                <p className="text-xs text-muted-foreground">
                  Get a free API key at{" "}
                  <a
                    href="https://financialmodelingprep.com/developer/docs/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    financialmodelingprep.com
                  </a>
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Free tier: 250 requests/day
                </p>
              </div>

              {/* Company Names Textarea */}
              <div className="space-y-2">
                <Label htmlFor="companies" className="text-sm font-medium">
                  Company Names
                </Label>
                <Textarea
                  id="companies"
                  name="companies"
                  placeholder={
                    "Apple Inc\nMicrosoft Corporation\nAmazon.com Inc\nAlphabet Inc"
                  }
                  className="min-h-[180px] font-mono text-sm bg-white dark:bg-slate-800 resize-y"
                  required
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 text-base font-medium"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Searching...
                  </span>
                ) : (
                  "Search Tickers"
                )}
              </Button>

              {/* Progress */}
              {progress && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <p className="text-sm text-muted-foreground">{progress}</p>
                </div>
              )}

              {/* TSV Output */}
              {csvOutput && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="csvOutput" className="text-sm font-medium">
                      TSV Output
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={copyToClipboard}
                      className="h-8"
                    >
                      {copied ? (
                        <span className="flex items-center gap-1.5 text-green-600">
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Copied!
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                          Copy
                        </span>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    id="csvOutput"
                    value={csvOutput}
                    readOnly
                    className="min-h-[200px] font-mono text-xs bg-slate-50 dark:bg-slate-800 resize-y"
                  />
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pb-8">
          Data provided by Financial Modeling Prep
        </p>
      </div>
    </div>
  );
}
