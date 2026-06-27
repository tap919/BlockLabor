import { APIKeyLoader } from "./api-key-loader";

describe("APIKeyLoader", () => {
  it("does not load hard-coded defaults when no env or APIs folder keys exist", () => {
    const loader = new APIKeyLoader({
      // point at a folder that should not exist in this repo
      apisFolder: "Z:\\__definitely_not_here__\\nope",
      debug: false,
    });
    const keys = loader.getAllKeys();
    expect(keys.deepseek).toBeUndefined();
    expect(keys.openai).toBeUndefined();
    expect(keys.mistral).toBeUndefined();
    expect(keys.ollama).toBeUndefined();
  });
});

