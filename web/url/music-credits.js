import {MUSIC_TRACKS} from './music-bed.js';

// Track identities follow the runtime manifest. Links were checked against
// the composer's official pages on 2026-09-17; these are credits, not a claim
// about any separate publishing permission or commercial-use license.
export const MUSIC_CREDITS=Object.freeze([
  Object.freeze({key:'normal',url:'https://www.d-elf.com/archives/7405.html'}),
  Object.freeze({key:'reach',url:'https://www.d-elf.com/youtube-free-bgm'}),
  Object.freeze({key:'rush',url:'https://www.d-elf.com/archives/11515.html'}),
  Object.freeze({key:'shadow',url:'https://www.d-elf.com/archives/12417.html'}),
  Object.freeze({key:'answer',url:'https://www.d-elf.com/archives/13184.html'}),
]);

export function renderMusicCredits(root){
  if(!root)return null;
  const existing=root.querySelector('[data-music-credits]');if(existing)return existing;
  const doc=root.ownerDocument,section=doc.createElement('section');
  section.className='help-music-credits';section.dataset.musicCredits='true';
  const heading=doc.createElement('h3');heading.textContent='使用している音楽';
  const link=(text,url)=>{const a=doc.createElement('a');a.textContent=text;a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;};
  const author=doc.createElement('p');author.className='help-music-author';author.append('楽曲制作：',link('D’elf / d-elf.com','https://www.d-elf.com/'));
  const list=doc.createElement('ul');
  for(const {key,url} of MUSIC_CREDITS){
    const item=doc.createElement('li'),a=link(MUSIC_TRACKS[key].title,url);
    a.setAttribute('aria-label',`${MUSIC_TRACKS[key].title} — 公式ページを別タブで開く`);item.append(a);list.append(item);
  }
  const note=doc.createElement('p');note.className='help-music-note';note.textContent='曲名を押すと、作者の公式紹介ページを開きます。';
  section.append(heading,author,list,note);root.append(section);return section;
}
