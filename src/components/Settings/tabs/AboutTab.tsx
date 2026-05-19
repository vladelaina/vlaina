import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ExternalLink, QrCode, RefreshCw } from 'lucide-react';
import { FaDiscord, FaQq, FaWeixin } from 'react-icons/fa';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { getElectronBridge } from '@/lib/electron/bridge';
import { getExternalLinkProps, openExternalHref } from '@/lib/navigation/externalLinks';
import { cn } from '@/lib/utils';
import { SettingsItem, SettingsSectionHeader } from '../components/SettingsControls';
import { useI18n } from '@/lib/i18n';
import { APP_VERSION } from '@/lib/appVersion';
import {
  type CommunitySettings,
  getCachedCommunitySettings,
  loadCommunitySettings,
} from './aboutCommunitySettings';

type UpdateStatus = 'idle' | 'checking' | 'current' | 'available' | 'error';

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  downloadUrl: string;
  releaseUrl: string;
  platformAssetName: string;
  hasPlatformAsset: boolean;
  releaseNotes: string;
  publishedAt: string;
}

const privacyPolicyUrl = 'https://github.com/vladelaina/vlaina/blob/main/PRIVACY.md';
const discordInviteUrl = 'https://discord.gg/nvsh9QpTqS';
const appLogoUrl = `${import.meta.env.BASE_URL}logo.png`;
const communityPillClassName =
  'inline-flex h-8 items-center gap-2 rounded-full px-3 text-[12px] font-semibold text-[var(--notes-sidebar-text)] transition-all duration-200';

function CommunityQrPill({
  title,
  label,
  icon,
  qrText,
  detail,
}: {
  title: string;
  label: string;
  icon: ReactNode;
  qrText: string;
  detail?: string;
}) {
  const [shouldRenderQr, setShouldRenderQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    if (!shouldRenderQr || !qrText) {
      setQrDataUrl('');
      return;
    }

    let cancelled = false;
    void import('qrcode')
      .then((QRCode) => QRCode.toString(qrText, {
        color: {
          dark: '#97c7ecff',
          light: '#ffffff00',
        },
        errorCorrectionLevel: 'M',
        margin: 1,
        type: 'svg',
        width: 144,
      }))
      .then((svg) => {
        if (!cancelled) {
          setQrDataUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [qrText, shouldRenderQr]);

  return (
    <div className="group relative" onMouseEnter={() => setShouldRenderQr(true)} onFocus={() => setShouldRenderQr(true)}>
      <button
        type="button"
        aria-label={title}
        className={cn(communityPillClassName, chatComposerPillSurfaceClass)}
      >
        {icon}
        <span>{label}</span>
      </button>
      <div className={cn(
        'pointer-events-none absolute left-1/2 top-full z-20 mt-3 w-[168px] -translate-x-1/2 rounded-[26px] p-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100',
        chatComposerPillSurfaceClass
      )}>
        {detail ? (
          <div className="mb-1 truncate text-center text-[12px] font-bold tabular-nums text-[var(--notes-sidebar-text)]">
            {detail}
          </div>
        ) : null}
        <div className="flex aspect-square w-full items-center justify-center rounded-[20px] text-[var(--notes-sidebar-text-soft)]">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={title} className="h-full w-full rounded-[16px] object-contain" draggable={false} />
          ) : (
            <div className="flex flex-col items-center gap-2 text-[12px] font-medium">
              <QrCode size={34} strokeWidth={1.7} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DiscordPill() {
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={() => void openExternalHref(discordInviteUrl)}
      aria-label={t('settings.about.openDiscord')}
      className={cn(communityPillClassName, chatComposerPillSurfaceClass)}
    >
      <FaDiscord size={15} className="text-[#5865F2]" />
      <span>{t('settings.about.discord')}</span>
    </button>
  );
}

function CommunityPills({ community }: { community: CommunitySettings }) {
  const { t } = useI18n();
  const hasQq = Boolean(community.qqQrCodeText);
  const hasWechat = Boolean(community.wechatQrCodeText);

  return (
    <div className="flex flex-wrap items-center gap-2 px-2">
      <DiscordPill />
      {hasQq ? (
        <CommunityQrPill
          title={t('settings.about.qqGroup')}
          label="QQ"
          icon={<FaQq size={15} className="text-[#12B7F5]" />}
          qrText={community.qqQrCodeText}
          detail={community.qqGroupNumber || undefined}
        />
      ) : null}
      {hasWechat ? (
        <CommunityQrPill
          title={t('settings.about.wechatGroup')}
          label="WeChat"
          icon={<FaWeixin size={15} className="text-[#07C160]" />}
          qrText={community.wechatQrCodeText}
        />
      ) : null}
    </div>
  );
}

function DeveloperNotePanel() {
  return (
    <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.64),rgba(255,255,255,0.38))] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(28,28,28,0.92),rgba(24,24,24,0.84))]">
      <div className="space-y-4 text-[14px] leading-7 text-[var(--notes-sidebar-text)]">
        <p className="text-[22px] font-semibold leading-8 text-[var(--notes-sidebar-text)]">
          Ciallo～(∠・ω&lt; )⌒★ 这里是{' '}
          <a className="text-[var(--vlaina-accent)]" {...getExternalLinkProps('https://vlaina.com')}>vlaina</a>
          {' '}和{' '}
          <a className="text-[var(--vlaina-accent)]" {...getExternalLinkProps('https://cati.me')}>Catime</a>
          {' '}的开发者{' '}
          <a className="text-[var(--vlaina-accent)]" {...getExternalLinkProps('https://vladelaina.com')}>vladelaina</a>
        </p>
        <p>你可能会好奇：</p>
        <ol className="list-decimal space-y-2 pl-5 text-[14px] leading-7 text-[var(--notes-sidebar-text)]">
          <li><strong>为什么看起来还有一些功能还没有？</strong></li>
          <li><strong>为什么有些交互做的很糙？</strong></li>
          <li><strong>这是一个收费软件吗？</strong></li>
        </ol>
        <p>
          vlaina从立项到第一版发布已经过去差不多8 个月，其实刚开始是想做todo+日历+笔记+ai对话的，就是那种聚合应用，做了两个月后悔了发现太多了，需要处理的细节实在是太多了，光靠一个人是很难完成的，最终只能将写了两个月的代码全部删掉重来。
        </p>
        <p>
          然后中途经历了一次框架的迁移，从tauri迁移到现在的Electron。刚开始的之所以选择tauri很大的原因是我是写C语言开发出生的，对于体积和资源占用特别敏感，要知道之前曾把<a className="text-[var(--vlaina-accent)]" {...getExternalLinkProps('https://cati.me')}>Catime</a>做到<strong>200kb</strong>（如果你还不知道<a className="text-[var(--vlaina-accent)]" {...getExternalLinkProps('https://cati.me')}>Catime</a>是什么,强烈推荐去试试，一款<strong>4k</strong> star纯C写的桌面计时器，资源占用极低），很自然的就选择了tauri。其实刚开始很犹豫，因为有信心应该可以将体积控制到<strong>20mb</strong>以下的，但是最终还是下定决心换掉了，至于原因主要还是多方面的，最主要的是我是用Arch作为我的主力操作系统，而tauri在linux上的存在一些细节问题，tauri很好用，只是不太适合vlaina，最后只能做迁移。
        </p>
        <h2 className="text-[16px] font-semibold leading-7 text-[var(--notes-sidebar-text)]">
          为啥会选择现在发而不是进一步去打磨呢？
        </h2>
        <p>
          其实很简单，这 8 个月是纯无收入的，兜里的钱只够撑到这个月了，没有投资人，如果再不上线很难继续维持开发工作了。
        </p>
        <h2 className="text-[16px] font-semibold leading-7 text-[var(--notes-sidebar-text)]">
          既然是开源项目，为啥不能做成纯打赏呢？
        </h2>
        <p>
          很简单，光靠打赏完全无法撑起一份全职工作。
        </p>
        <p>
          在开发 Vlaina 之前，在大学期间用一年多的时间开发了一款特别棒的倒计时工具<a className="text-[var(--vlaina-accent)]" {...getExternalLinkProps('https://cati.me')}>Catime</a>，一个用纯 C 写的花费无数个日夜一行一行实现，在 GitHub 上收获了 4,000 颗 Star，拥有十几万用户，这对我来说是莫大的荣幸，从没想过居然能做到这个地步，可能4kstar并不是很直观，<a className="text-[var(--vlaina-accent)]" {...getExternalLinkProps('https://cati.me')}>Catime</a>是Github的<a className="text-[var(--vlaina-accent)]" {...getExternalLinkProps('https://github.com/topics/clock')}>Topics的clock分区的第二名</a>，第一名是一款mac工具，而这一切都只花了差不多一年的时间，而迟迟没做mac端的原因其实只是没钱买mac，但后续一定会支持上！
        </p>
        <h2 className="text-[16px] font-semibold leading-7 text-[var(--notes-sidebar-text)]">
          那做这么“强”是不是赚麻了？怎么会.....
        </h2>
        <p>
          在那一年多的时间里，通过 <a className="text-[var(--vlaina-accent)]" {...getExternalLinkProps('https://cati.me')}>Catime</a>，我获得的全部经济回报大约是 <strong>3000</strong> 元人民币。这其中一半来自 <strong>50</strong> 多位非常有爱的用户打赏，另一半来自一次朋友推荐的赞助和服务器赞助。这对于学生时期的我来说简直就是一笔巨款，哈哈哈
        </p>
        <p>但现在已经毕业了，就需要开始发愁如何养活自己。</p>
        <h2 className="text-[16px] font-semibold leading-7 text-[var(--notes-sidebar-text)]">
          那你为什么不去找个班上然后一边上班一边做开源项目？
        </h2>
        <p>
          其实我试过，但是对于我来说根本做不到，在差不多八个月之前，我加入了一家北京的初创公司，工作是早10晚7的，双休。刚开始我自己算算每天还有很长的时间可以投入到开源项目中去，但是你去看<a className="text-[var(--vlaina-accent)]" {...getExternalLinkProps('https://cati.me')}>Catime</a>的提交历史会发现有一段时间的提交次数会很少，有段时间甚至都不想打开项目目录。因为是第一次来北京工作，一个学生手里基本没有半点积蓄的，只能选择住在4号线的末班站，当然也是合租，而且房间特别小，就是小到你无法相信的地步，然后每天光去上班需要将近一个半小时，每天来回光通勤就差不多3个小时的样子。为了省钱，外卖自然也是点不起的，只能自己做饭，从买菜到吃上我记得要到10点了，没错，就.....提离谱的，然后再洗个澡就是....第二天早上需要7点起床，因为我还需要自己做早餐。
        </p>
        <p>
          这么一算其实每天基本就没什么时间是属于自己的了，我记得每次下班回家我不知道为什么，我没有之前的激情了，之前做<a className="text-[var(--vlaina-accent)]" {...getExternalLinkProps('https://cati.me')}>catime</a>我能干到凌晨3，4点，但这个时候我甚至都不想打开电脑，虽然我每天都会把电脑从公司背回来，但每次只想躺在床上打开手机用B站刷视频。
        </p>
        <h2 className="text-[16px] font-semibold leading-7 text-[var(--notes-sidebar-text)]">
          那周末呢？你周末总有时间了吧？
        </h2>
        <p>
          不知道为什么我都不想打开我的电脑，一方面是出租房配备的是那种很矮的桌子和没有靠背的凳子，连桌子都无法放下我的键盘，还有一方面是因为感觉很累，却是挺奇怪了的，对比我现在开发vlaina，每天开发10几个小时依然每天精力满满的状态完全不一样。
        </p>
        <p>工作上的事因为一些原因这里不太方便说。就是我后面我发现我只适合单干，我想我还是想做属于我自己的项目，或者或可以由自己掌控的项目，所以我选择了辞职，至于辞职之后要干什么说实话我并不知道....</p>
        <h3 className="text-[14px] font-semibold leading-6 text-[var(--notes-sidebar-text)]">
          以下是我离职的时候发给老板的消息：
        </h3>
        <div className="rounded-[18px] border border-white/10 bg-black/5 px-4 py-3 text-[13px] leading-6 text-[var(--notes-sidebar-text-soft)] dark:bg-white/5">
          <p className="mt-3 whitespace-pre-wrap">
            “未来的事情真是神奇，8个月我真的是一个nobody，什么都没有，没有人脉，没有<a className="text-[var(--vlaina-accent)]" {...getExternalLinkProps('https://cati.me')}>catime</a>，真的就是一无所有，做梦都没想到会有今天。{'\n'}我想，我们终将在顶峰相见。”
          </p>
        </div>
        <p>
          然后8个月后的今天我带着我的新项目来了，我并不指望靠它赚很多很多的钱，只要够养活自己就好
        </p>
        <h2 className="text-[16px] font-semibold leading-7 text-[var(--notes-sidebar-text)]">
          这是一个收费软件不？
        </h2>
        <p>
          算也不算，vlaina没有强制收费的，甚至连ai渠道商完全可以自定义，你可以不花一分钱就可以使用到完整的所有功能。
        </p>
        <p>
          说实话我也不想做那种，因为很享受自己的软件可以帮助到很多人的感觉，这或许是个人价值的一种实现吧。
        </p>
        <p>
          如果你想支持vlaian的开发工作，拥有省心、开箱即用的体验可以考虑订阅我们的会员，这对我来说非常重要。同时如果你也可以完全零成本接入自己的 API。
        </p>
        <p>
          如果有遇到任何交互体验上的问题，或者有任何好点子，一定要联系开发者。尽量每周发布一个小版本来优化体验，同时我们需要大量的测试，如果你想参与进来，非常欢迎加入我们的社群和社区。
        </p>
        <p className="text-[var(--vlaina-color-brand-pink)]">
          最后，特别感谢那些从<a className="text-[var(--vlaina-color-brand-pink)]" {...getExternalLinkProps('https://cati.me')}>catime</a>开始就是支持的朋友们ヾ(๑╹ヮ╹๑)ﾉ”，说真的没有你们我没有勇气离职，不敢去做自己想做的事情也没有今天的vlaina。
        </p>
      </div>
    </div>
  );
}

export function AboutTab() {
  const { t } = useI18n();
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [currentVersion, setCurrentVersion] = useState('');
  const [community, setCommunity] = useState<CommunitySettings>(() => getCachedCommunitySettings());

  useEffect(() => {
    const bridge = getElectronBridge();
    if (!bridge?.app) {
      return;
    }

    void bridge.app.getVersion().then((version) => {
      setCurrentVersion(version);
    }).catch(() => {
      setCurrentVersion('');
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadCommunitySettings().then((settings) => {
      if (!cancelled) {
        setCommunity(settings);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const checkForUpdates = useCallback(async () => {
    const bridge = getElectronBridge();
    if (!bridge?.update) {
      setStatus('error');
      return;
    }

    setStatus('checking');

    try {
      const nextInfo = await bridge.update.check();
      setUpdateInfo(nextInfo);
      setStatus(nextInfo.updateAvailable ? 'available' : 'current');
    } catch (error) {
      setStatus('error');
    }
  }, [t]);

  const hasUpdate = status === 'available' && Boolean(updateInfo);

  const openUpdateDownload = useCallback(() => {
    if (!hasUpdate || !updateInfo?.downloadUrl) return;
    void openExternalHref(updateInfo.downloadUrl);
  }, [hasUpdate, updateInfo?.downloadUrl]);

  const statusLabel = (() => {
    if (status === 'checking') return t('common.checking');
    if (status === 'available' && updateInfo) return t('settings.about.updateAvailable', { version: updateInfo.latestVersion });
    if (status === 'current') return t('settings.about.upToDate');
    if (status === 'error') return t('common.checkFailed');
    return '';
  })();

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-7 py-2">
        <img
          src={appLogoUrl}
          alt="vlaina"
          className="h-32 w-32 shrink-0 rounded-[28px] object-contain"
          draggable={false}
        />
        <div className="min-w-0 pt-1">
          <a
            {...getExternalLinkProps('https://vlaina.com')}
            className="inline-block max-w-full truncate text-[22px] font-semibold leading-7 text-[var(--vlaina-accent)]"
          >
            vlaina
          </a>
          <div className="mt-1 truncate text-[13px] font-normal leading-5 text-[var(--notes-sidebar-text-soft)] tabular-nums">
            {currentVersion || APP_VERSION}
          </div>
        </div>
      </div>

      <div>
        <SettingsSectionHeader>{t('settings.about.updates')}</SettingsSectionHeader>
        <SettingsItem
          title={t('settings.about.updates')}
          description={statusLabel || undefined}
          className="hover:!shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)]"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={checkForUpdates}
              disabled={status === 'checking'}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-[13px] font-medium text-[var(--notes-sidebar-text)] transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-[#242424] dark:hover:bg-white/10"
            >
              <RefreshCw size={15} className={cn(status === 'checking' && 'animate-spin')} />
              {t('common.check')}
            </button>
            {hasUpdate ? (
              <button
                type="button"
                onClick={openUpdateDownload}
                title={updateInfo?.platformAssetName || undefined}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1E96EB] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#167fd0]"
              >
                <ExternalLink size={15} />
                {t('settings.about.updateAction')}
              </button>
            ) : null}
          </div>
        </SettingsItem>
      </div>

      <CommunityPills community={community} />

      <div>
        <SettingsSectionHeader>{t('settings.about.privacy')}</SettingsSectionHeader>
        <SettingsItem title={t('settings.about.openPrivacyPolicy')} className="hover:!shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)]">
          <button
            type="button"
            onClick={() => void openExternalHref(privacyPolicyUrl)}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-[13px] font-medium text-[var(--notes-sidebar-text)] transition-colors hover:bg-zinc-50 dark:border-white/10 dark:bg-[#242424] dark:hover:bg-white/10"
          >
            <ExternalLink size={15} />
            {t('common.open')}
          </button>
        </SettingsItem>
      </div>

      <DeveloperNotePanel />
    </div>
  );
}
