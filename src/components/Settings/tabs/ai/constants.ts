import openaiIcon from '@/components/Chat/assets/providers/openai.png';
import anthropicIcon from '@/components/Chat/assets/providers/anthropic.png';
import googleIcon from '@/components/Chat/assets/providers/google.png';
import deepseekIcon from '@/components/Chat/assets/providers/deepseek.png';
import ollamaIcon from '@/components/Chat/assets/providers/ollama.png';
import newapiIcon from '@/components/Chat/assets/providers/newapi.png';
import groqIcon from '@/components/Chat/assets/providers/groq.png';
import openrouterIcon from '@/components/Chat/assets/providers/openrouter.png';
import siliconIcon from '@/components/Chat/assets/providers/silicon.png';
import togetherIcon from '@/components/Chat/assets/providers/together.png';
import mistralIcon from '@/components/Chat/assets/providers/mistral.png';
import perplexityIcon from '@/components/Chat/assets/providers/perplexity.png';
import moonshotIcon from '@/components/Chat/assets/providers/moonshot.webp';
import zhipuIcon from '@/components/Chat/assets/providers/zhipu.png';
import zeroOneIcon from '@/components/Chat/assets/providers/zero-one.png';
import doubaoIcon from '@/components/Chat/assets/providers/doubao.png';
import dashscopeIcon from '@/components/Chat/assets/providers/dashscope.png';
import grokXIcon from '@/components/Chat/assets/providers/grok.png';
import cohereIcon from '@/components/Chat/assets/providers/cohere.png';
import huggingfaceIcon from '@/components/Chat/assets/providers/huggingface.webp';
import minimaxIcon from '@/components/Chat/assets/providers/minimax.png';
import stepIcon from '@/components/Chat/assets/providers/step.png';
import lmstudioIcon from '@/components/Chat/assets/providers/lmstudio.png';
import githubIcon from '@/components/Chat/assets/providers/github.png';
import nvidiaIcon from '@/components/Chat/assets/providers/nvidia.png';
import baichuanIcon from '@/components/Chat/assets/providers/baichuan.png';
import ai302Icon from '@/components/Chat/assets/providers/302ai.webp';
import aihubmixIcon from '@/components/Chat/assets/providers/aihubmix.png';
import gpustackIcon from '@/components/Chat/assets/providers/gpustack.svg';
import tencentIcon from '@/components/Chat/assets/providers/tencent-cloud-ti.png';
import fireworksIcon from '@/components/Chat/assets/providers/fireworks.png';
import cerebrasIcon from '@/components/Chat/assets/providers/cerebras.webp';
import leptonIcon from '@/components/Chat/assets/providers/lepton.png';
import novitaIcon from '@/components/Chat/assets/providers/ph8.png';
import volcengineIcon from '@/components/Chat/assets/providers/volcengine.png';
import voyageIcon from '@/components/Chat/assets/providers/voyageai.png';
import modelscopeIcon from '@/components/Chat/assets/providers/modelscope.png';
import jinaIcon from '@/components/Chat/assets/providers/jina.png';
import hyperbolicIcon from '@/components/Chat/assets/providers/hyperbolic.png';
import infiniIcon from '@/components/Chat/assets/providers/infini.png';
import dmxapiIcon from '@/components/Chat/assets/providers/DMXAPI.png';
import giteeIcon from '@/components/Chat/assets/providers/gitee-ai.png';
import baiduIcon from '@/components/Chat/assets/providers/baidu-cloud.svg';
import vertexIcon from '@/components/Chat/assets/providers/vertexai.svg';
import bedrockIcon from '@/components/Chat/assets/providers/aws-bedrock.webp';
import xirangIcon from '@/components/Chat/assets/providers/xirang.png';
import qiniuIcon from '@/components/Chat/assets/providers/qiniu.webp';
import nomicIcon from '@/components/Chat/assets/providers/nomic.png';
import mixedbreadIcon from '@/components/Chat/assets/providers/mixedbread.png';
import longcatIcon from '@/components/Chat/assets/providers/longcat.png';
import intelIcon from '@/components/Chat/assets/providers/intel.png';
import sophnetIcon from '@/components/Chat/assets/providers/sophnet.svg';
import lanyunIcon from '@/components/Chat/assets/providers/lanyun.png';
import cephalonIcon from '@/components/Chat/assets/providers/cephalon.jpeg';
import burncloudIcon from '@/components/Chat/assets/providers/burncloud.png';
import alayaIcon from '@/components/Chat/assets/providers/alayanew.webp';
import aiOnlyIcon from '@/components/Chat/assets/providers/aiOnly.webp';

export interface ProviderConfig {
  id: string;
  name: string;
  icon: string;
  defaultBaseUrl: string;
  description?: string;
}

export const SUPPORTED_PROVIDERS: ProviderConfig[] = [
  {
    id: 'custom',
    name: 'New API',
    icon: newapiIcon,
    defaultBaseUrl: '',
    description: 'Connect to any OpenAI-compatible API',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: openaiIcon,
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: anthropicIcon,
    defaultBaseUrl: 'https://api.anthropic.com/v1',
  },
  {
    id: 'google',
    name: 'Google Gemini',
    icon: googleIcon,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: deepseekIcon,
    defaultBaseUrl: 'https://api.deepseek.com',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    icon: ollamaIcon,
    defaultBaseUrl: 'http://localhost:11434/v1',
  },
  {
    id: 'silicon',
    name: 'SiliconFlow',
    icon: siliconIcon,
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: openrouterIcon,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
  },
  {
    id: 'groq',
    name: 'Groq',
    icon: groqIcon,
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
  },
  {
    id: 'together',
    name: 'Together AI',
    icon: togetherIcon,
    defaultBaseUrl: 'https://api.together.xyz/v1',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    icon: mistralIcon,
    defaultBaseUrl: 'https://api.mistral.ai/v1',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    icon: perplexityIcon,
    defaultBaseUrl: 'https://api.perplexity.ai',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    icon: nvidiaIcon,
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
  },
  {
    id: 'moonshot',
    name: 'Moonshot (Kimi)',
    icon: moonshotIcon,
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
  },
  {
    id: 'zhipu',
    name: 'Zhipu AI (GLM)',
    icon: zhipuIcon,
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  },
  {
    id: 'zeroone',
    name: '01.AI (Yi)',
    icon: zeroOneIcon,
    defaultBaseUrl: 'https://api.lingyiwanwu.com/v1',
  },
  {
    id: 'doubao',
    name: 'Doubao (ByteDance)',
    icon: doubaoIcon,
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  },
  {
    id: 'dashscope',
    name: 'DashScope (Aliyun)',
    icon: dashscopeIcon,
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  {
    id: 'baichuan',
    name: 'Baichuan',
    icon: baichuanIcon,
    defaultBaseUrl: 'https://api.baichuan-ai.com/v1',
  },
  {
    id: 'grok',
    name: 'Grok (xAI)',
    icon: grokXIcon,
    defaultBaseUrl: 'https://api.x.ai/v1',
  },
  {
    id: 'cohere',
    name: 'Cohere',
    icon: cohereIcon,
    defaultBaseUrl: 'https://api.cohere.com/v1',
  },
  {
    id: 'huggingface',
    name: 'HuggingFace',
    icon: huggingfaceIcon,
    defaultBaseUrl: 'https://api-inference.huggingface.co/v1',
  },
  {
    id: 'minimax',
    name: 'Minimax',
    icon: minimaxIcon,
    defaultBaseUrl: 'https://api.minimax.chat/v1',
  },
  {
    id: 'stepfun',
    name: 'StepFun',
    icon: stepIcon,
    defaultBaseUrl: 'https://api.stepfun.com/v1',
  },
  {
    id: 'tencent',
    name: 'Tencent Hunyuan',
    icon: tencentIcon,
    defaultBaseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    icon: fireworksIcon,
    defaultBaseUrl: 'https://api.fireworks.ai/inference/v1',
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    icon: cerebrasIcon,
    defaultBaseUrl: 'https://api.cerebras.ai/v1',
  },
  {
    id: 'lepton',
    name: 'Lepton AI',
    icon: leptonIcon,
    defaultBaseUrl: 'https://api.lepton.ai/v1',
  },
  {
    id: 'novita',
    name: 'Novita AI',
    icon: novitaIcon,
    defaultBaseUrl: 'https://api.novita.ai/v3/openai',
  },
  {
    id: 'volcengine',
    name: 'Volcengine (Volcano)',
    icon: volcengineIcon,
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  },
  {
    id: 'voyage',
    name: 'Voyage AI',
    icon: voyageIcon,
    defaultBaseUrl: 'https://api.voyageai.com/v1',
  },
  {
    id: 'modelscope',
    name: 'ModelScope',
    icon: modelscopeIcon,
    defaultBaseUrl: 'https://api-inference.modelscope.cn/v1',
  },
  {
    id: 'jina',
    name: 'Jina AI',
    icon: jinaIcon,
    defaultBaseUrl: 'https://api.jina.ai/v1',
  },
  {
    id: 'hyperbolic',
    name: 'Hyperbolic',
    icon: hyperbolicIcon,
    defaultBaseUrl: 'https://api.hyperbolic.xyz/v1',
  },
  {
    id: 'infini',
    name: 'Infini AI',
    icon: infiniIcon,
    defaultBaseUrl: 'https://api.infini-ai.com/v1',
  },
  {
    id: 'dmxapi',
    name: 'DMXAPI',
    icon: dmxapiIcon,
    defaultBaseUrl: 'https://api.dmxapi.com/v1',
  },
  {
    id: 'gitee',
    name: 'Gitee AI',
    icon: giteeIcon,
    defaultBaseUrl: 'https://ai.gitee.com/v1',
  },
  {
    id: 'baidu',
    name: 'Baidu Cloud',
    icon: baiduIcon,
    defaultBaseUrl: 'https://qianfan.baidubce.com/v2',
  },
  {
    id: 'vertex',
    name: 'Vertex AI',
    icon: vertexIcon,
    defaultBaseUrl: 'https://us-central1-aiplatform.googleapis.com/v1',
  },
  {
    id: 'bedrock',
    name: 'AWS Bedrock',
    icon: bedrockIcon,
    defaultBaseUrl: '',
  },
  {
    id: 'xirang',
    name: 'Xirang',
    icon: xirangIcon,
    defaultBaseUrl: '',
  },
  {
    id: 'qiniu',
    name: 'Qiniu',
    icon: qiniuIcon,
    defaultBaseUrl: '',
  },
  {
    id: 'nomic',
    name: 'Nomic',
    icon: nomicIcon,
    defaultBaseUrl: 'https://api.nomic.ai/v1',
  },
  {
    id: 'mixedbread',
    name: 'MixedBread',
    icon: mixedbreadIcon,
    defaultBaseUrl: '',
  },
  {
    id: 'longcat',
    name: 'LongCat',
    icon: longcatIcon,
    defaultBaseUrl: '',
  },
  {
    id: 'intel',
    name: 'Intel',
    icon: intelIcon,
    defaultBaseUrl: '',
  },
  {
    id: 'sophnet',
    name: 'Sophon',
    icon: sophnetIcon,
    defaultBaseUrl: '',
  },
  {
    id: 'lanyun',
    name: 'Lanyun',
    icon: lanyunIcon,
    defaultBaseUrl: '',
  },
  {
    id: 'cephalon',
    name: 'Cephalon',
    icon: cephalonIcon,
    defaultBaseUrl: '',
  },
  {
    id: 'burncloud',
    name: 'Burn Cloud',
    icon: burncloudIcon,
    defaultBaseUrl: '',
  },
  {
    id: 'alaya',
    name: 'Alaya',
    icon: alayaIcon,
    defaultBaseUrl: '',
  },
  {
    id: 'aionly',
    name: 'AI Only',
    icon: aiOnlyIcon,
    defaultBaseUrl: '',
  },
  {
    id: 'github',
    name: 'GitHub Models',
    icon: githubIcon,
    defaultBaseUrl: 'https://models.inference.ai.azure.com',
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    icon: lmstudioIcon,
    defaultBaseUrl: 'http://localhost:1234/v1',
  },
  {
    id: '302ai',
    name: '302.AI',
    icon: ai302Icon,
    defaultBaseUrl: 'https://api.302.ai/v1',
  },
  {
    id: 'aihubmix',
    name: 'AiHubMix',
    icon: aihubmixIcon,
    defaultBaseUrl: 'https://aihubmix.com/v1',
  },
  {
    id: 'gpustack',
    name: 'GPUStack',
    icon: gpustackIcon,
    defaultBaseUrl: 'http://localhost:10000/v1',
  },
];
