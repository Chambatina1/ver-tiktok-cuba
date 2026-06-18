// Cloudflare Worker — Proxy para ver TikTok desde Cuba
// Todo pasa por Cloudflare, Cuba solo ve solicitudes a workers.dev

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers para todas las respuestas
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // === SERVIR EL HTML ===
    if (path === '/' || path === '/index.html') {
      const html = getHTML(url.origin);
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders },
      });
    }

    // === PROXY API — llama a TikWM desde el servidor ===
    if (path === '/api/fetch') {
      const tiktokUrl = url.searchParams.get('url');
      if (!tiktokUrl) {
        return new Response(JSON.stringify({ error: 'Falta parametro url' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      try {
        const formData = new FormData();
        formData.append('url', tiktokUrl);
        formData.append('web', '1');
        formData.append('hd', '1');

        const resp = await fetch('https://www.tikwm.com/api/', {
          method: 'POST',
          body: formData,
        });
        const data = await resp.json();

        if (data.code === 0 && data.data) {
          // Convertir URLs relativas de TikWM a absolutas
          const d = data.data;
          if (d.origin_cover && !d.origin_cover.startsWith('http')) {
            d.origin_cover = 'https://www.tikwm.com' + d.origin_cover;
          }
          if (d.cover && !d.cover.startsWith('http')) {
            d.cover = 'https://www.tikwm.com' + d.cover;
          }
          if (d.author && d.author.avatar && !d.author.avatar.startsWith('http')) {
            d.author.avatar = 'https://www.tikwm.com' + d.author.avatar;
          }
          if (d.play_url && !d.play_url.startsWith('http')) {
            d.play_url = 'https://www.tikwm.com' + d.play_url;
          }
        }

        // Fallback a noembed si TikWM falla
        if (data.code !== 0 || !data.data) {
          const neResp = await fetch('https://noembed.com/embed?url=' + encodeURIComponent(tiktokUrl));
          const neData = await neResp.json();
          if (!neData.error) {
            return new Response(JSON.stringify({ source: 'noembed', data: neData }), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
          return new Response(JSON.stringify({ error: 'No se pudo obtener el contenido' }), {
            status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        return new Response(JSON.stringify({ source: 'tikwm', data: data.data }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // === PROXY DE IMAGENES ===
    if (path === '/img') {
      const imgUrl = url.searchParams.get('url');
      if (!imgUrl) {
        return new Response('Falta parametro url', { status: 400, headers: corsHeaders });
      }

      try {
        const resp = await fetch(imgUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.tiktok.com/',
          },
        });

        if (!resp.ok) {
          return new Response('Imagen no disponible', { status: resp.status, headers: corsHeaders });
        }

        const contentType = resp.headers.get('Content-Type') || 'image/jpeg';
        const buffer = await resp.arrayBuffer();

        return new Response(buffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
            ...corsHeaders,
          },
        });
      } catch (err) {
        return new Response('Error cargando imagen', { status: 500, headers: corsHeaders });
      }
    }

    // === PROXY DE VIDEO ===
    if (path === '/video') {
      const videoUrl = url.searchParams.get('url');
      if (!videoUrl) {
        return new Response('Falta parametro url', { status: 400, headers: corsHeaders });
      }

      try {
        const resp = await fetch(videoUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.tiktok.com/',
          },
        });

        if (!resp.ok) {
          return new Response('Video no disponible', { status: resp.status, headers: corsHeaders });
        }

        const contentType = resp.headers.get('Content-Type') || 'video/mp4';
        const buffer = await resp.arrayBuffer();

        return new Response(buffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
            ...corsHeaders,
          },
        });
      } catch (err) {
        return new Response('Error cargando video', { status: 500, headers: corsHeaders });
      }
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  },
};

// ============================================================
// HTML — este se sirve desde el propio Worker
// El navegador SOLO habla con el Worker (mismo dominio)
// Nunca toca TikWM ni TikTok directamente
// ============================================================
function getHTML(origin) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>Ver TikTok desde Cuba | Chambatina</title>
<meta name="description" content="Mira contenido de TikTok desde Cuba sin VPN">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0a;color:#fff;min-height:100vh}
.header{border-bottom:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.3);backdrop-filter:blur(10px);padding:16px}
.header-inner{max-width:600px;margin:0 auto;display:flex;align-items:center;gap:12px}
.logo{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#ec4899,#8b5cf6);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;flex-shrink:0}
.header h1{font-size:16px;font-weight:700}
.header p{font-size:11px;color:#888}
.container{max-width:600px;margin:0 auto;padding:20px 16px}
.search{display:flex;gap:8px;margin-bottom:6px}
.search input{flex:1;height:48px;padding:0 16px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.08);color:#fff;font-size:14px;outline:none}
.search input:focus{border-color:rgba(236,72,153,.5);box-shadow:0 0 0 3px rgba(236,72,153,.15)}
.search input::placeholder{color:#666}
.search button{height:48px;padding:0 20px;border-radius:12px;border:none;background:linear-gradient(135deg,#ec4899,#8b5cf6);color:#fff;font-weight:600;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap}
.search button:disabled{opacity:.4;cursor:not-allowed}
.hint{font-size:11px;color:#555;margin-bottom:20px}
.loading{text-align:center;padding:60px 0}
.spinner{width:48px;height:48px;border:3px solid rgba(236,72,153,.2);border-top-color:#ec4899;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}
@keyframes spin{to{transform:rotate(360deg)}}
.card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden;margin-bottom:16px}
.card img.cover-img{width:100%;display:block;background:#111;min-height:200px;object-fit:cover}
.card-info{padding:16px}
.author{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.author-avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#ec4899,#8b5cf6);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;overflow:hidden}
.author-avatar img{width:100%;height:100%;object-fit:cover}
.card-info h2{font-size:15px;font-weight:600;margin-bottom:8px;line-height:1.4}
.card-info p.desc{font-size:13px;color:#ccc;line-height:1.5;white-space:pre-wrap}
.stats{display:flex;gap:16px;margin-top:12px;font-size:12px;color:#888}
.img-container{position:relative;background:#111;min-height:200px;display:flex;align-items:center;justify-content:center}
.img-container img{width:100%;height:auto;display:block}
.video-container{position:relative;background:#000;min-height:200px;display:flex;align-items:center;justify-content:center}
.video-container video{width:100%;max-height:600px;display:block}
.btn-wa{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:52px;border-radius:12px;border:none;background:#22c55e;color:#fff;font-weight:600;font-size:15px;cursor:pointer;text-decoration:none;margin-bottom:12px;box-shadow:0 8px 24px rgba(34,197,94,.25)}
.btn-wa:hover{background:#16a34a}
.btn-share{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#fff;font-weight:500;font-size:13px;cursor:pointer;margin-bottom:24px}
.btn-share:hover{background:rgba(255,255,255,.1)}
.footer{text-align:center;padding:16px;font-size:11px;color:#444}
.footer span{color:#ec4899;font-weight:600}
.showcase-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
.showcase-item{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;overflow:hidden;cursor:pointer;transition:all .2s}
.showcase-item:hover{border-color:rgba(236,72,153,.4)}
.showcase-item .thumb{aspect-ratio:9/12;background:#111;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}
.showcase-item .thumb img{width:100%;height:100%;object-fit:cover}
.showcase-item .thumb .ov{position:absolute;bottom:0;left:0;right:0;padding:10px;background:linear-gradient(transparent,rgba(0,0,0,.8));font-size:11px;color:#fff;font-weight:500}
.gallery{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:16px;border-radius:12px;overflow:hidden}
.gallery img{width:100%;aspect-ratio:9/12;object-fit:cover;display:block;cursor:pointer}
</style>
</head>
<body>
<div class="header"><div class="header-inner"><div class="logo">T</div><div><h1>Ver TikTok desde Cuba</h1><p>Sin VPN, sin app</p></div></div></div>
<div class="container">
  <div class="search"><input type="text" id="urlInput" placeholder="Pega el link de TikTok aqui..." /><button onclick="go()" id="goBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Ver</button></div>
  <p class="hint">Pega cualquier link de TikTok</p>
  <div id="content"></div>
  <div class="footer">Powered by <span>Chambatina</span> — Tu puente con Cuba</div>
</div>
<script>
var PH='17869426904';
// Todo va al mismo Worker — el navegador nunca sale de este dominio
var API='/api/fetch?url=';
var IMG='/img?url=';

var ui=document.getElementById('urlInput'),ct=document.getElementById('content'),goBtn=document.getElementById('goBtn');
ui.addEventListener('keydown',function(e){if(e.key==='Enter')go()});

var p=new URLSearchParams(location.search);
var iu=p.get('url')||p.get('u');
if(iu){ui.value=iu;go()}else{loadShowcase()}

var SHOWCASE=[
  'https://www.tiktok.com/@chambatina/photo/7511890283794025758',
  'https://www.tiktok.com/@chambatina'
];

function loadShowcase(){
  var h='<div class="showcase-grid">';
  for(var i=0;i<SHOWCASE.length;i++){
    var u=SHOWCASE[i],isP=u.match(/\\/@[\\w.]+$/);
    h+='<div class="showcase-item" onclick="loadUrl(\\''+u+'\\')"><div class="thumb" id="t'+i+'"><div style="color:#555;font-size:32px">&#9835;</div>'+(isP?'<div class="ov">@chambatina</div>':'<div class="ov">Cargando...</div>')+'</div></div>';
  }
  h+='</div>';
  ct.innerHTML=h;
  for(var i=0;i<SHOWCASE.length;i++)loadThumb(SHOWCASE[i],i);
}

function loadThumb(url,idx){
  fetch(API+encodeURIComponent(url)).then(function(r){return r.json()}).then(function(j){
    if(!j.data)return;
    var d=j.data,img='',title='';
    if(j.source==='noembed'){
      img=j.data.thumbnail_url||'';title=j.data.title||'TikTok';
    }else{
      if(d.images&&d.images.length)img=d.images[0];
      else img=d.origin_cover||d.cover||'';
      title=d.title||'TikTok';
    }
    if(!img)return;
    var el=document.getElementById('t'+idx);if(!el)return;
    var im=new Image();
    im.onload=function(){el.innerHTML='<img src="'+IMG+encodeURIComponent(img)+'" /><div class="ov">'+esc(title)+'</div>'};
    im.onerror=function(){el.innerHTML='<div style="color:#555;font-size:32px">&#9835;</div><div class="ov">'+esc(title)+'</div>'};
    im.src=IMG+encodeURIComponent(img);
  }).catch(function(){});
}

function loadUrl(url){ui.value=url;go()}

function go(){
  var url=ui.value.trim();if(!url)return;
  if(!url.startsWith('http'))url='https://'+url;
  goBtn.disabled=true;
  ct.innerHTML='<div class="loading"><div class="spinner"></div><p style="color:#888;font-size:13px">Obteniendo contenido...</p></div>';

  fetch(API+encodeURIComponent(url)).then(function(r){return r.json()}).then(function(j){
    if(j.error)throw new Error(j.error);
    if(j.source==='noembed')return renderNoEmbed(j.data,url);
    if(j.data)return renderTikWM(j.data,url);
    throw new Error('no data');
  }).catch(function(err){
    console.error(err);
    renderFallback(url);
  }).finally(function(){goBtn.disabled=false});
}

function getImgUrl(rawUrl){return IMG+encodeURIComponent(rawUrl)}

function renderTikWM(d,url){
  var isPhoto=d.images&&d.images.length>0;
  var au=d.author?(d.author.nickname||d.author.unique_id||''):'';
  var av=d.author&&d.author.avatar?d.author.avatar:'';
  var desc=d.desc||'';
  if(d.content_desc&&d.content_desc.length)desc+=(desc?'\\n':'')+d.content_desc.join('\\n');
  var st=[];
  if(d.play_count)st.push('\\u2764\\uFE0F '+fN(d.play_count));
  if(d.comment_count)st.push('\\uD83D\\uDCAC '+fN(d.comment_count));
  if(d.share_count)st.push('\\uD83D\\uDD17 '+fN(d.share_count));

  var wt=encodeURIComponent('Vi esto en tu TikTok y me interesa:\\n\\n'+(d.title||'Video')+'\\nAutor: @'+au+'\\n\\nLink: '+url);
  var wl='https://wa.me/'+PH+'?text='+wt;
  history.replaceState({},'','?url='+encodeURIComponent(url));

  var h='<div class="card">';

  // Photo gallery
  if(isPhoto){
    h+='<div class="gallery">';
    for(var i=0;i<d.images.length;i++){
      h+='<img src="'+getImgUrl(d.images[i])+'" onclick="window.open(this.src,\\'_blank\\')" />';
    }
    h+='</div>';
  }
  // Video
  else if(d.play_url){
    h+='<div class="video-container"><video controls preload="metadata" poster="'+getImgUrl(d.origin_cover||d.cover||'')+'"><source src="'+getImgUrl(d.play_url)+'" type="video/mp4">Tu navegador no soporta video.</video></div>';
  }
  // Cover image only
  else if(d.origin_cover||d.cover){
    var coverImg=d.origin_cover||d.cover;
    h+='<div class="img-container"><img class="cover-img" src="'+getImgUrl(coverImg)+'" /></div>';
  }

  h+='<div class="card-info">';
  if(au){
    var avH=av?'<img src="'+getImgUrl(av)+'" onerror="this.parentNode.textContent=\\''+esc(au[0]).toUpperCase()+'\\'" />':esc(au[0]).toUpperCase();
    h+='<div class="author"><div class="author-avatar">'+avH+'</div><div><div style="font-size:13px;font-weight:600">@'+esc(au.replace('@',''))+'</div><div style="font-size:11px;color:#888">TikTok</div></div></div>';
  }
  if(d.title)h+='<h2>'+esc(d.title)+'</h2>';
  if(desc.trim())h+='<p class="desc">'+esc(desc.trim())+'</p>';
  if(st.length)h+='<div class="stats">'+st.join('  ')+'</div>';
  h+='</div></div>';
  h+='<a class="btn-wa" href="'+wl+'" target="_blank" rel="noopener">Lo quiero — Comprar por WhatsApp</a>';
  h+='<button class="btn-share" onclick="share()">Compartir</button>';
  ct.innerHTML=h;
}

function renderNoEmbed(ne,url){
  var title=ne.title||'Contenido de TikTok';
  var author=ne.author_name||'';
  var thumb=ne.thumbnail_url||'';
  var wt=encodeURIComponent('Vi esto en TikTok y me interesa:\\n\\n'+title+(author?'\\nAutor: '+author:'')+'\\n\\nLink: '+url);
  var wl='https://wa.me/'+PH+'?text='+wt;
  history.replaceState({},'','?url='+encodeURIComponent(url));
  var h='<div class="card">';
  if(thumb)h+='<div class="img-container"><img class="cover-img" src="'+getImgUrl(thumb)+'" /></div>';
  h+='<div class="card-info">';
  if(author)h+='<div class="author"><div class="author-avatar">'+esc(author[0]).toUpperCase()+'</div><div><div style="font-size:13px;font-weight:600">'+esc(author)+'</div></div></div>';
  h+='<h2>'+esc(title)+'</h2>';
  h+='</div></div>';
  h+='<a class="btn-wa" href="'+wl+'" target="_blank" rel="noopener">Me interesa — Contactar por WhatsApp</a>';
  h+='<button class="btn-share" onclick="share()">Compartir</button>';
  ct.innerHTML=h;
}

function renderFallback(url){
  var wt=encodeURIComponent('Vi un enlace de TikTok que me interesa:\\n'+url);
  var wl='https://wa.me/'+PH+'?text='+wt;
  ct.innerHTML='<div class="card" style="text-align:center;padding:40px 20px"><div style="width:80px;height:80px;border-radius:16px;background:rgba(236,72,153,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 16px"><svg viewBox="0 0 24 24" fill="#ec4899" width="40" height="40"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46A6.34 6.34 0 0015.35 15V8.39a8.16 8.16 0 004.24 1.19V6.11a4.85 4.85 0 01-1-.42z"/></svg></div><h3 style="font-size:17px;margin-bottom:8px">No se pudo cargar</h3><p style="font-size:12px;color:#888;word-break:break-all;margin-bottom:16px">'+esc(url)+'</p></div><a class="btn-wa" href="'+wl+'" target="_blank" rel="noopener">Me interesa — Contactar por WhatsApp</a>';
}

function share(){
  var u=location.origin+location.pathname+'?url='+encodeURIComponent(ui.value);
  if(navigator.share)navigator.share({title:'Ver TikTok desde Cuba',url:u});
  else{navigator.clipboard.writeText(u);var b=document.querySelector('.btn-share');if(b){b.textContent='Copiado!';setTimeout(function(){b.textContent='Compartir'},2000)}}
}
function fN(n){if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'K';return String(n)}
function esc(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML}
</script>
</body>
</html>`;
}