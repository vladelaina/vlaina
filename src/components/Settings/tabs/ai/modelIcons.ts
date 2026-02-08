<<<<<<< HEAD
=======
import BaichuanLogo from '@/components/Chat/assets/models/baichuan.png';
import ChatGLMLogo from '@/components/Chat/assets/models/chatglm.png';
import ChatGptLogo from '@/components/Chat/assets/models/chatgpt.jpeg';
import ClaudeLogo from '@/components/Chat/assets/models/claude.png';
import CohereLogo from '@/components/Chat/assets/models/cohere.png';
import CopilotLogo from '@/components/Chat/assets/models/copilot.png';
import DalleLogo from '@/components/Chat/assets/models/dalle.png';
import DeepSeekLogo from '@/components/Chat/assets/models/deepseek.png';
import DoubaoLogo from '@/components/Chat/assets/models/doubao.png';
import GeminiLogo from '@/components/Chat/assets/models/gemini.png';
import GoogleLogo from '@/components/Chat/assets/models/google.png';
import Gpt35Logo from '@/components/Chat/assets/models/gpt_3.5.png';
import Gpt4Logo from '@/components/Chat/assets/models/gpt_4.png';
import GptO1Logo from '@/components/Chat/assets/models/gpt_o1.png';
import Gpt5Logo from '@/components/Chat/assets/models/gpt-5.png';
import Gpt5MiniLogo from '@/components/Chat/assets/models/gpt-5-mini.png';
import Gpt5NanoLogo from '@/components/Chat/assets/models/gpt-5-nano.png';
import Gpt51Logo from '@/components/Chat/assets/models/gpt-5.1.png';
import GptImageLogo from '@/components/Chat/assets/models/gpt_image_1.png';
import GrokLogo from '@/components/Chat/assets/models/grok.png';
import HuggingfaceLogo from '@/components/Chat/assets/models/huggingface.png';
import HunyuanLogo from '@/components/Chat/assets/models/hunyuan.png';
import InternlmLogo from '@/components/Chat/assets/models/internlm.png';
import JinaLogo from '@/components/Chat/assets/models/jina.png';
import LlamaLogo from '@/components/Chat/assets/models/llama.png';
import MicrosoftLogo from '@/components/Chat/assets/models/microsoft.png';
import MinimaxLogo from '@/components/Chat/assets/models/minimax.png';
import MistralLogo from '@/components/Chat/assets/models/mixtral.png';
import MoonshotLogo from '@/components/Chat/assets/models/moonshot.webp';
import NvidiaLogo from '@/components/Chat/assets/models/nvidia.png';
import PerplexityLogo from '@/components/Chat/assets/models/perplexity.png';
import QwenLogo from '@/components/Chat/assets/models/qwen.png';
import SparkDeskLogo from '@/components/Chat/assets/models/sparkdesk.png';
import StabilityLogo from '@/components/Chat/assets/models/stability.png';
import StepLogo from '@/components/Chat/assets/models/step.png';
import WenxinLogo from '@/components/Chat/assets/models/wenxin.png';
import YiLogo from '@/components/Chat/assets/models/yi.png';
import ZhipuLogo from '@/components/Chat/assets/models/zhipu.png';
import FluxLogo from '@/components/Chat/assets/models/flux.png';
import MidjourneyLogo from '@/components/Chat/assets/models/midjourney.png';
import SunoLogo from '@/components/Chat/assets/models/suno.png';
import LumaLogo from '@/components/Chat/assets/models/luma.png';
import KelingLogo from '@/components/Chat/assets/models/keling.png';
import ViduLogo from '@/components/Chat/assets/models/vidu.png';
import HailuoLogo from '@/components/Chat/assets/models/hailuo.png';
import CodestralLogo from '@/components/Chat/assets/models/codestral.png';
import DbrxLogo from '@/components/Chat/assets/models/dbrx.png';
import UpstageLogo from '@/components/Chat/assets/models/upstage.png';
import VoyageLogo from '@/components/Chat/assets/models/voyageai.png';
import TeleLogo from '@/components/Chat/assets/models/tele.png';
import IdeogramLogo from '@/components/Chat/assets/models/ideogram.svg';
import BigcodeLogo from '@/components/Chat/assets/models/bigcode.webp';
import RakutenLogo from '@/components/Chat/assets/models/rakutenai.png';
import AdeptLogo from '@/components/Chat/assets/models/adept.png';
import Ai21Logo from '@/components/Chat/assets/models/ai21.png';
import MediatekLogo from '@/components/Chat/assets/models/mediatek.png';
import XirangLogo from '@/components/Chat/assets/models/xirang.png';
import MimoLogo from '@/components/Chat/assets/models/mimo.svg';
import AimassLogo from '@/components/Chat/assets/models/aimass.png';
import AisingaporeLogo from '@/components/Chat/assets/models/aisingapore.png';
import BgeLogo from '@/components/Chat/assets/models/bge.webp';
import CodegeexLogo from '@/components/Chat/assets/models/codegeex.png';
import DianxinLogo from '@/components/Chat/assets/models/dianxin.png';
import FlashaudioLogo from '@/components/Chat/assets/models/flashaudio.png';
import GrypheLogo from '@/components/Chat/assets/models/gryphe.png';
import IbmLogo from '@/components/Chat/assets/models/ibm.png';
import InternvlLogo from '@/components/Chat/assets/models/internvl.png';
import LingLogo from '@/components/Chat/assets/models/ling.png';
import LlavaLogo from '@/components/Chat/assets/models/llava.png';
import MagicLogo from '@/components/Chat/assets/models/magic.png';
import MinicpmLogo from '@/components/Chat/assets/models/minicpm.webp';
import NousResearchLogo from '@/components/Chat/assets/models/nousresearch.png';
import PalmLogo from '@/components/Chat/assets/models/palm.png';
import PanguLogo from '@/components/Chat/assets/models/pangu.svg';
import PixtralLogo from '@/components/Chat/assets/models/pixtral.png';
import TokenFluxLogo from '@/components/Chat/assets/models/tokenflux.png';
import ByteDanceLogo from '@/components/Chat/assets/models/byte_dance.svg';
import EmbeddingLogo from '@/components/Chat/assets/models/embedding.png';

>>>>>>> main
export function getModelLogoById(modelId: string): string | undefined {
  if (!modelId) return undefined;
  
  // Map keywords to filenames in /public/models/
  const logoMap: Record<string, string> = {
    'flux': 'flux.png',
    'midjourney': 'midjourney.png',
    'mj-': 'midjourney.png',
    'suno': 'suno.png',
    'chirp': 'suno.png',
    'luma': 'luma.png',
    'keling': 'keling.png',
    'vidu': 'vidu.png',
    'hailuo': 'hailuo.png',
    'ideogram': 'ideogram.svg',
    'codestral': 'codestral.png',
    'dbrx': 'dbrx.png',
    'upstage': 'upstage.png',
    'voyage': 'voyageai.png',
    'tele': 'tele.png',
    'bigcode': 'bigcode.webp',
    'rakuten': 'rakutenai.png',
    'adept': 'adept.png',
    'ai21': 'ai21.png',
    'mediatek': 'mediatek.png',
    'xirang': 'xirang.png',
    'mimo': 'mimo.svg',
    'aimass': 'aimass.png',
    'aisingapore': 'aisingapore.png',
    'bge-': 'bge.webp',
    'codegeex': 'codegeex.png',
    'dianxin': 'dianxin.png',
    'flashaudio': 'flashaudio.png',
    'gpt-5.1': 'gpt-5.1.png',
    'gpt-5-mini': 'gpt-5-mini.png',
    'gpt-5-nano': 'gpt-5-nano.png',
    'gpt-5': 'gpt-5.png',
    'gpt-image': 'gpt_image_1.png',
    'gryphe': 'gryphe.png',
    'mythomax': 'gryphe.png',
    'ibm': 'ibm.png',
    'granite': 'ibm.png',
    'internvl': 'internvl.png',
    'ling': 'ling.png',
    'llava': 'llava.png',
    'magic': 'magic.png',
    'minicpm': 'minicpm.webp',
    'nous': 'nousresearch.png',
    'hermes': 'nousresearch.png',
    'palm': 'palm.png',
    'bison': 'palm.png',
    'pangu': 'pangu.svg',
    'pixtral': 'pixtral.png',
    'tokenflux': 'tokenflux.png',
    'bytedance': 'byte_dance.svg',
    'embedding': 'embedding.png',
    'o1-': 'gpt_o1.png',
    'gpt-4': 'gpt_4.png',
    'gpt-3.5': 'gpt_3.5.png',
    'gpt-': 'chatgpt.jpeg',
    'claude': 'claude.png',
    'gemini': 'gemini.png',
    'deepseek': 'deepseek.png',
    'qwen': 'qwen.png',
    'qwq': 'qwen.png',
    'llama': 'llama.png',
    'mixtral': 'mixtral.png',
    'mistral': 'mixtral.png', // Using mixtral logo for mistral too? Or separate? Check file list. 'mixtral_dark.png' exists.
    'moonshot': 'moonshot.webp',
    'kimi': 'moonshot.webp',
    'baichuan': 'baichuan.png',
    'glm': 'chatglm.png',
    'zhipu': 'zhipu.png',
    'doubao': 'doubao.png',
    'minimax': 'minimax.png',
    'abab': 'minimax.png',
    'yi-': 'yi.png',
    'grok': 'grok.png',
    'hunyuan': 'hunyuan.png',
    'spark': 'sparkdesk.png',
    'internlm': 'internlm.png',
    'jina': 'jina.png',
    'cohere': 'cohere.png',
    'copilot': 'copilot.png',
    'dall-e': 'dalle.png',
    'stable-diffusion': 'stability.png',
    'sdxl': 'stability.png',
    'perplexity': 'perplexity.png',
    'sonar': 'perplexity.png',
    'step': 'step.png',
    'wenxin': 'wenxin.png',
    'ernie': 'wenxin.png',
    'google': 'google.png',
    'microsoft': 'microsoft.png',
    'nvidia': 'nvidia.png',
    'huggingface': 'huggingface.png',
    '360': '360.png'
  };

  for (const key in logoMap) {
    if (new RegExp(key, 'i').test(modelId)) {
      return `/models/${logoMap[key]}`;
    }
  }

  return undefined;
}