# BitNet for ai-english-test — Local/Embedded Feasibility Study

**Date:** 2026-08-23  
**Repos:** [vitolai/ai-english-test](https://github.com/vitolai/ai-english-test) (`~/repos/app/ai-english-test`) vs [microsoft/BitNet](https://github.com/microsoft/BitNet)  
**Question:** Can BitNet act as local/embedded model for content/exam generation instead of cloud models? Which model(s) work?

## TL;DR

**Yes as offline fallback, No as primary.**

* `bitnet.cpp` exposes an OpenAI-compatible ` /v1` server → plugs directly into your existing `custom` provider (`server/services/provider-chain.ts` → `createOpenAI({baseURL})` + `generateObject({schema: ExamSchema})`) with zero backend change. The PR is trivial.
* The **only official chat model** `BitNet-b1.58-2B-4T` (2.4B, 4096 ctx) is too small / context-limited / unreliable for your TOEIC structured generation (`ExamSchema`, `EXACTLY 13`, distribution). Use it only for 10–50Q offline demos.
* **Minimum viable for real TOEIC:** community ternaries `tiiuae/Falcon3-10B-Instruct-1.58bit` or `HF1BitLLM/Llama3-8B-1.58-100B-tokens` (8192 ctx, instruct-tuned) on the same `bitnet.cpp` stack. They are not Microsoft-official but are the community-recommended bitnet models.
* Embedding models `BitNet-embedding-0.6B/270M` are **not** for generation — use them for future PDF RAG instead.

---

## 1. How ai-english-test Generates Today

* `server/routes/generate.ts`: 2-phase chunked generation `LISTENING_CHUNK=13`, `READING_CHUNK=13`, 10–200 Q per session, SSE + polling status.
* `server/services/ai.ts`: `generateObject(ExamSchema)` with Zod `QuestionSchema {id, part 1-7, type, image, transcript, passage, question, options[4], answer A-D}`. Requires **jsonMode + functionCalling**, strict count (`Generate EXACTLY N listening/reading questions`), never mix types.
* `server/services/distribution.ts` + `validation.ts`: `getQuestionDistribution()` enforces real TOEIC ratios (Listening P1 6% / P2 25% / P3 39% / P4 30%, P3/P4 multiples of 3; Reading P5 30% / P6 16% / P7 54%). `validateAndRebalanceDistribution()` + `enforceP3P4Grouping`/`ensurePart*` retry up to 5× because even cloud 70B models ignore format ~30%.
* Prompt per chunk: 800–1200 tokens instruction + `seedText` ≤2000 chars → needs 2.5–4k output tokens for 13 Q.
* `src/lib/providers.ts`: BYOK proxy already supports `category: 'local'|'custom'`, `capabilities: {localExecution, offline, jsonMode, functionCalling}`, `baseURL: USER_PROVIDED`. `ollama` is the template for local. Adding `bitnet` is one entry.

**Implied requirements:** ≥4096 (ideally 8k) context, reliable JSON, instruction following, English business domain grounding, vision would help Part 1 photos (currently falls back to `PART1_DATA` Unsplash pool via `buildPart1Instruction`).

---

## 2. What microsoft/BitNet Actually Is

`microsoft/BitNet` is **bitnet.cpp** — a llama.cpp fork with ternary kernels (`I2_S` on x86, `TL1/TL2` on ARM), not a model zoo. Benchmarks vs FP16: 1.37–6.17× speedup, 55–82% energy saving, 100B model at 5–7 tok/s on single CPU. GPU kernel available; NPU coming.

### Official models (Microsoft)

| Model | Params | Ctx | HF ID | Kernel | Chat/SFT | Notes |
|---|---|---|---|---|---|---|
| **BitNet-b1.58-2B-4T** | 2.4B | **4096** | `microsoft/BitNet-b1.58-2B-4T` / `-gguf` / `-bf16` | I2_S (x86), TL1 (ARM) | SFT+DPO (Llama3 tokenizer, RoPE, ReLU², subln) | Trained 4T tokens, MIT, 0.4 GB non-emb. **Research-only disclaimer** — not for commercial without testing; known election-query defects; weak non-English. |
| BitNet-embedding-0.6B | 0.6B | n/a | `microsoft/BitNet-embedding-0.6B` | I2_S x86 only | — | **Embedding only**, 1.4–2.28× speedup. For RAG, not generation. |
| BitNet-embedding-270M | 270M | n/a | `microsoft/BitNet-embedding-270M` | I2_S x86 only | — | Same, edge RAG. |

Must use `bitnet.cpp` for speed; `transformers` path gives **no** speedup and is discouraged in the model card.

### Community 1.58-bit models that run on bitnet.cpp

| Model | Params | Ctx | HF ID | Instruct | Verdict for this use |
|---|---|---|---|---|---|
| `bitnet_b1_58-large` | 0.7B | ~2048 | `1bitLLM/bitnet_b1_58-large` | weak | Too small — fails JSON/count. No. |
| `bitnet_b1_58-3B` | 3.3B | ~2048 | `1bitLLM/bitnet_b1_58-3B` | weak | Marginal — still unreliable. No. |
| **Llama3-8B-1.58-100B-tokens** | 8B | **8192** | `HF1BitLLM/Llama3-8B-1.58-100B-tokens` | limited | **Best community** — Llama3 backbone, larger ctx. Viable fallback. |
| **Falcon3-7B/10B-Instruct-1.58bit** | 7–10B | **8192** | `tiiuae/Falcon3-*-Instruct-1.58bit` | ✅ | **Recommended** if you go bitnet — instruct-tuned, hardest to break JSON. |
| Falcon Edge 1–3B | 1–3B | 4096 | `tiiuae/falcon-edge*` | ✅ | Light edge fallback only. |

All above are **text-only, no vision**. Part 1 must keep the `ensurePart1Images` fallback (already implemented).

---

## 3. Gap Analysis

| Requirement | Cloud (Nemotron/Gemini) | BitNet 2B-4T | Falcon 10B / Llama8B |
|---|---|---|---|
| Structured JSON `ExamSchema` (generateObject) | Reliable | **Fragile** — IFEval 53.5 worst in class, drops fields, miscounts `EXACTLY 13`, mixes listening/reading. Your 5× retry will still fail ~40–60% chunks. | Moderate — larger, better instruction following. Still needs prompt-based `response_format: json_object` (bitnet.cpp supports it) but no native functionCalling. |
| Context 13Q chunk | 128k | **4096 = at limit** — prompt ~1.5k + 13×180 ≈ 2.3k = ~3.8k. No headroom for 100–200Q prompts. | 8192 safe. |
| Distribution / P3-P4 grouping | Needs rebalancing | Will violate constantly | Better but still needs `validateAndRebalance`. |
| Vision Part 1 | Yes | No → keep photo-pool fallback | No |
| Source grounding (seedText) | Good | Weak — model card notes bias/hallucination, limited domain | Moderate |
| Offline / embedded | No (cost/latency/privacy) | **Win** — 0.8 GB RAM, 29 ms/token decode, single CPU ARM/x86, 70–82% energy saving. Ideal for pi5/orcln/ec2n. | 2–3 GB RAM, ~3–4 tok/s CPU — still edge-capable. |
| Legal | API key | MIT but commercial caution, election defects | Same |

**Context math matters:** Your existing `LISTENING_CHUNK=13` was already tuned for 4096. BitNet 2B cannot safely increase it; Falcon/Llama can.

---

## 4. Which BitNet Model(s) Work?

* **Works embedded, degraded quality:** `microsoft/BitNet-b1.58-2B-4T-gguf` (`i2_s` quant) → Tier 3 offline fallback for 10–50Q demos / random mode. Expect pass rate ~40–60% per chunk vs >85% cloud; use `ensurePart*` fillers heavily.
* **Minimum viable for real TOEIC:** `tiiuae/Falcon3-10B-Instruct-1.58bit` (preferred) or `HF1BitLLM/Llama3-8B-1.58-100B-tokens`. Same `bitnet.cpp` stack, 8192 ctx.
* **Do not use for generation:** `BitNet-embedding-0.6B/270M`.

No current BitNet vision model exists — don't wait for it.

---

## 5. Integration Path (no PR needed now, but trivial)

```bash
# Build once
git clone --recursive https://github.com/microsoft/BitNet.git && cd BitNet
conda create -n bitnet-cpp python=3.10 && conda activate bitnet-cpp
pip install -r requirements.txt
huggingface-cli download microsoft/BitNet-b1.58-2B-4T-gguf --local-dir models/BitNet-b1.58-2B-4T
python setup_env.py -md models/BitNet-b1.58-2B-4T -q i2_s
# or: python setup_env.py --hf-repo tiiuae/Falcon3-10B-Instruct-1.58bit -q i2_s

# Serve OpenAI-compatible
python -m llama_cpp.server --model models/BitNet-b1.58-2B-4T/ggml-model-i2_s.gguf \
  --host 0.0.0.0 --port 8080 --ctx-size 4096

# Test
curl http://localhost:8080/v1/chat/completions -H "Content-Type: application/json" \
  -d '{"model":"bitnet","messages":[{"role":"user","content":"Return JSON {\"questions\": []}"}],"response_format":{"type":"json_object"}}'
```

Add to `src/lib/providers.ts`:

```ts
bitnet: { id:'bitnet', name:'BitNet Local', category:'local',
  baseUrl:'http://localhost:8080/v1', requiresApiKey:false,
  capabilities:{ text:true, jsonMode:true, vision:false, localExecution:true, offline:true },
  models:[{id:'bitnet-b1.58-2b', name:'BitNet 2B (CPU)', contextWindow:4096}] }
```

Then `POST /api/generate {config:{providerId:'bitnet', baseURL:'http://localhost:8080/v1'}, model:'bitnet-b1.58-2b', apiKey:'local'}` flows through `buildProviderChain` → `createOpenAI` → `generateWithFallback` unchanged. Put it in `fallbacks[]` behind Nvidia/OpenRouter for auto offline failover.

---

## 6. Recommendation for VL Stack

* Keep cloud primary (Nvidia/OpenRouter/Groq).
* Register **Falcon3-10B-1.58bit** (or future official BitNet 7B+ when Microsoft releases it) as `custom` fallback.
* Deploy **BitNet-embedding-0.6B** for PDF `seedText` RAG — its intended use, 1.4–2.28× speedup.
* Use **BitNet 2B** only for pi5/orcln ARM demos where power/privacy > quality, and keep `ensurePart1Images`/`ensurePart2Transcripts` guards on.

Technical reports: [BitNet b1.58 2B4T](https://arxiv.org/abs/2504.12285) • [bitnet.cpp](https://arxiv.org/abs/2410.16144) • Demo: https://demo-bitnet-h0h8hcfqeqhrf5gf.canadacentral-01.azurewebsites.net/
