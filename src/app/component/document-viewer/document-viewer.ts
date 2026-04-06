import {
  Component,
  Input,
  OnChanges,
  OnInit,
  OnDestroy,
  SimpleChanges,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  ViewChild,
  ElementRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

// PrimeNG
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

// ─────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────
export interface DocComment {
  id: string;
  lineId: string;
  author: string;
  initials: string;
  bg: string;
  fg: string;
  status: 'approved' | 'rejected' | 'pending';
  time: string;
  text: string;
}

interface WordTooltip {
  visible: boolean;
  x: number;
  y: number;
  author: string;
  initials: string;
  bg: string;
  fg: string;
  text: string;
}

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────
@Component({
  selector: 'app-document-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    ProgressSpinnerModule,
  ],
  templateUrl: './document-viewer.html',
  styleUrl: './document-viewer.scss',
})
export class DocumentViewerComponent implements OnInit, OnChanges, OnDestroy {

  // ── inputs ────────────────────────────────────────────
  @Input() docUrl: string =
    'assets/doc-annotated.html';
  @Input() dialogHeader: string = 'Document Review';

  // ── template refs ─────────────────────────────────────
  @ViewChild('docIframe') iframeRef!: ElementRef<HTMLIFrameElement>;
  @ViewChild('commentList') commentListRef!: ElementRef<HTMLDivElement>;

  // ── dialog & iframe state ─────────────────────────────
  dialogVisible = false;
  iframeLoading = true;
  iframeError = false;
  safeDocUrl!: SafeResourceUrl;

  // ── responsive ────────────────────────────────────────
  isMobile = false;
  drawerOpen = false;

  get dialogStyle(): Record<string, string> {
    return this.isMobile
      ? { width: '100vw', height: '100dvh', maxWidth: '100vw', margin: '0', borderRadius: '0' }
      : { width: '92vw', maxWidth: '1200px', height: '88vh' };
  }

  // ── tooltip ───────────────────────────────────────────
  tooltip: WordTooltip = {
    visible: false, x: 0, y: 0,
    author: '', initials: '', bg: '', fg: '', text: '',
  };

  private tooltipTimer: ReturnType<typeof setTimeout> | null = null;

  // ── selected comment ──────────────────────────────────
  selectedComment: DocComment | null = null;

  // ── static comments ───────────────────────────────────
  readonly comments: DocComment[] = [
    {
      id: 'c1', lineId: 'p1__w1',          // "Quantitative" — paragraph 1, word 1
      author: 'Zainab Khan', initials: 'ZH', bg: '#534AB7', fg: '#EEEDFE',
      status: 'rejected', time: 'Just now',
      text: 'Should "Quantitative" be changed to "Qualitative" here?',
    },
    {
      id: 'c2', lineId: 'p1__w2',          // "survey" — paragraph 1, word 2
      author: 'Samuel Castro', initials: 'SC', bg: '#1D9E75', fg: '#fff',
      status: 'approved', time: '2 mins ago',
      text: '"survey" — confirm this is not a tracker study.',
    },
    {
      id: 'c3', lineId: 'p27__w5',         // "beauty" — paragraph 27, word 5
      author: 'Ahmad Baghdadi', initials: 'AB', bg: '#D85A30', fg: '#fff',
      status: 'approved', time: '3 days ago',
      text: '"beauty" — should specify personal care or HBA only?',
    },
    {
      id: 'c4', lineId: 'p29__w0',         // "Please" — paragraph 29, word 0
      author: 'Samuel Castro', initials: 'SC', bg: '#1D9E75', fg: '#fff',
      status: 'approved', time: '5 hrs ago',
      text: '"Please" — start with the actual action verb instead.',
    },
    {
      id: 'c5', lineId: 'p31__w3',         // "decide" — paragraph 31, word 3
      author: 'Zainab Khan', initials: 'ZH', bg: '#534AB7', fg: '#EEEDFE',
      status: 'pending', time: '1 hr ago',
      text: '"decide" — this word is ambiguous for non-English speakers.',
    },
    {
      id: 'c6', lineId: 'p42__w0',         // "Sometimes" — paragraph 42, word 0
      author: 'Ahmad Baghdadi', initials: 'AB', bg: '#D85A30', fg: '#fff',
      status: 'rejected', time: '2 days ago',
      text: '"Sometimes" — remove, it weakens the question.',
    },
    {
      id: 'c7', lineId: 'p88__w1',         // "hair removal" — paragraph 88, word 1
      author: 'Samuel Castro', initials: 'SC', bg: '#1D9E75', fg: '#fff',
      status: 'pending', time: '4 hrs ago',
      text: '"hair removal" — add "permanent" to clarify intent.',
    },
    {
      id: 'c8', lineId: 'p96__w2',         // "Laser/IPL" — paragraph 96, word 2
      author: 'Ahmad Baghdadi', initials: 'AB', bg: '#D85A30', fg: '#fff',
      status: 'approved', time: '1 day ago',
      text: '"Laser/IPL" — should always be hyphenated consistently.',
    },
    {
      id: 'c9', lineId: 'p119__w3',        // "own" — paragraph 119, word 3
      author: 'Zainab Khan', initials: 'ZH', bg: '#534AB7', fg: '#EEEDFE',
      status: 'rejected', time: '6 hrs ago',
      text: '"own" — rephrase to "currently own or have owned".',
    },
  ];
  // ── comment lookup by lineId ───────────────────────────
  private readonly commentByLineId = new Map<string, DocComment>(
    this.comments.map(c => [c.lineId, c])
  );

  // ── tabs ──────────────────────────────────────────────
  activeTab: 'comments' | 'logs' = 'comments';

  // ── iframe message listener ref ───────────────────────
  private iframeMessageHandler: ((e: MessageEvent) => void) | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
  ) { }

  // ─────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────
  ngOnInit(): void {
    this.setSafeUrl();
    this.checkMobile();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['docUrl']) {
      this.setSafeUrl();
      this.iframeLoading = true;
      this.iframeError = false;
    }
  }

  ngOnDestroy(): void {
    this.removeIframeListener();
    if (this.tooltipTimer) clearTimeout(this.tooltipTimer);
  }

  // ── responsive breakpoint ─────────────────────────────
  @HostListener('window:resize')
  checkMobile(): void {
    if (typeof window !== 'undefined') {
      this.isMobile = window.innerWidth < 768;
    } else {
      this.isMobile = false;
    }
    this.cdr.markForCheck();
  }

  // ─────────────────────────────────────────────────────
  // Safe URL
  // ─────────────────────────────────────────────────────
  setSafeUrl(): void {
    this.safeDocUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.docUrl);
  }

  // ─────────────────────────────────────────────────────
  // Dialog
  // ─────────────────────────────────────────────────────
  openDialog(): void {
    this.dialogVisible = true;
    this.iframeLoading = true;
    this.iframeError = false;
    this.checkMobile();

    setTimeout(() => {
      if (this.iframeLoading) {
        this.iframeError = true;
        this.iframeLoading = false;
        this.cdr.markForCheck();
      }
    }, 8000);
  }

  closeDialog(): void {
    this.dialogVisible = false;
    this.clearSelection();
    this.hideTooltip();
    this.removeIframeListener();
  }

  // ─────────────────────────────────────────────────────
  // Iframe — load & word injection
  // ─────────────────────────────────────────────────────
  onIframeLoad(): void {
    this.iframeLoading = false;
    this.cdr.markForCheck();
    setTimeout(() => this.injectWordHighlights(), 300);
  }

  onIframeError(): void {
    this.iframeLoading = false;
    this.iframeError = true;
    this.cdr.markForCheck();
  }

  private injectWordHighlights(): void {
    const iframe = this.iframeRef?.nativeElement;
    if (!iframe) return;

    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;
      const style = doc.createElement('style');
      style.textContent = `
  .dv-word-highlight {
    cursor: pointer;
    border-radius: 2px;
    padding-bottom: 1px;
    position: relative;
  }
  .dv-avatar-bubble {
    position: absolute;
    top: 10px;
    left: 0;
    width: 40px; height: 40px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 600;
    pointer-events: none;
    z-index: 9999;
    box-shadow: 0 2px 6px rgba(0,0,0,0.18);
  }
`;
      doc.head.appendChild(style);

      // Attach click handler to each comment word element
      this.comments.forEach(comment => {
        const el = doc.getElementById(comment.lineId);
        if (!el) return;

        el.addEventListener('click', () => {
          // Remove any existing avatar on this element
          el.querySelectorAll('.dv-avatar-bubble').forEach(b => b.remove());

          // Create avatar bubble
          const bubble = doc.createElement('span');
          bubble.className = 'dv-avatar-bubble';
          bubble.textContent = comment.initials;
          bubble.style.background = comment.bg;
          bubble.style.color = comment.fg;
          el.style.position = 'relative';
          el.appendChild(bubble);

          // Auto-remove after 3 s
          setTimeout(() => bubble.remove(), 3000);

          const currentRect = el.getBoundingClientRect();
          window.parent.postMessage(
            { type: 'dv-word-click', lineId: comment.lineId, rect: { top: currentRect.top, left: currentRect.left } },
            '*'
          );
        });
      });

    } catch (crossOriginErr) {
      console.warn('DocumentViewer: iframe is cross-origin, word highlighting skipped.', crossOriginErr);
    }

    // ✅ Host window listens for messages from the iframe
    this.removeIframeListener();
    this.iframeMessageHandler = (e: MessageEvent) => {
      if (e.data?.type !== 'dv-word-click') return;
      this.onWordClick(e.data.lineId, e.data.rect);
    };
    window.addEventListener('message', this.iframeMessageHandler);

  }


  private removeIframeListener(): void {
    if (this.iframeMessageHandler) {
      window.removeEventListener('message', this.iframeMessageHandler);
      this.iframeMessageHandler = null;
    }
  }

  // ─────────────────────────────────────────────────────
  // Word click handler
  // ─────────────────────────────────────────────────────
  onWordClick(lineId: string, rect?: { top: number; left: number }): void {
    const comment = this.commentByLineId.get(lineId);
    if (!comment) return;

    // ── Compute tooltip position ──────────────────────
    const iframe = this.iframeRef?.nativeElement;
    const panel = iframe?.parentElement;
    const panelRect = panel?.getBoundingClientRect();

    let tooltipX = 24;
    let tooltipY = 24;

    if (rect && panelRect) {
      // ✅ rect is already in viewport (screen) coords
      //    Subtract panelRect to get position relative to the doc-panel div
      tooltipX = (rect.left ?? 0) - (panelRect.left ?? 0);
      tooltipY = (rect.top ?? 0) - (panelRect.top ?? 0) - 48; // show above the word

      // Clamp so tooltip never overflows the panel edges
      tooltipX = Math.max(8, Math.min(tooltipX, (panelRect.width ?? 300) - 220));
      tooltipY = Math.max(8, tooltipY);
    }

    this.tooltip = {
      visible: true,
      x: tooltipX,
      y: tooltipY,
      author: comment.author,
      initials: comment.initials,
      bg: comment.bg,
      fg: comment.fg,
      text: comment.text,
    };

    // Auto-dismiss after 4 s
    if (this.tooltipTimer) clearTimeout(this.tooltipTimer);
    this.tooltipTimer = setTimeout(() => this.hideTooltip(), 4000);

    // ── Select comment card & switch to comments tab ──
    this.selectedComment = comment;
    this.activeTab = 'comments';

    // ── On mobile: open the drawer ────────────────────
    if (this.isMobile) {
      this.drawerOpen = true;
    }

    this.cdr.markForCheck();

    // ── Scroll comment card into view ─────────────────
    setTimeout(() => {
      const cardEl = this.commentListRef?.nativeElement
        ?.querySelector(`[data-comment-id="${comment.id}"]`) as HTMLElement | null;
      cardEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
  }

  hideTooltip(): void {
    this.tooltip.visible = false;
    this.cdr.markForCheck();
  }

  // ─────────────────────────────────────────────────────
  // Comment selection
  // ─────────────────────────────────────────────────────
  selectComment(c: DocComment): void {
    this.selectedComment = this.selectedComment?.id === c.id ? null : c;

    if (this.selectedComment) {
      this.highlightWordInIframe(this.selectedComment.lineId);
    }

    this.cdr.markForCheck();
  }

  private highlightWordInIframe(lineId: string): void {
    try {
      const doc = this.iframeRef?.nativeElement?.contentDocument;
      if (!doc) return;
      doc.querySelectorAll('.dv-word-active')
        .forEach(el => el.classList.remove('dv-word-active'));
      const el = doc.getElementById(lineId);
      if (el) {
        el.classList.add('dv-word-active');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch { /* cross-origin, skip */ }
  }

  clearSelection(): void {
    this.selectedComment = null;
    this.cdr.markForCheck();
  }

  // ─────────────────────────────────────────────────────
  // Tabs
  // ─────────────────────────────────────────────────────
  switchTab(tab: 'comments' | 'logs'): void {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  // ─────────────────────────────────────────────────────
  // Mobile drawer
  // ─────────────────────────────────────────────────────
  toggleDrawer(): void {
    this.drawerOpen = !this.drawerOpen;
    this.cdr.markForCheck();
  }

  // ─────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────
  getSeverity(
    status: string,
  ): 'success' | 'danger' | 'warn' | 'info' | 'secondary' | 'contrast' {
    const map: Record<string, 'success' | 'danger' | 'warn'> = {
      approved: 'success',
      rejected: 'danger',
      pending: 'warn',
    };
    return map[status] ?? 'warn';
  }

  get totalComments(): number { return this.comments.length; }
}
