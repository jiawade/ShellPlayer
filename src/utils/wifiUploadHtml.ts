// src/utils/wifiUploadHtml.ts
// Embedded HTML page served by the WiFi transfer HTTP server

export function getWifiUploadHtml(lang = 'zh', platform = 'ios'): string {
  const isZh = lang.startsWith('zh');
  const subtitle = isZh ? 'WiFi 无线传输' : 'WiFi Transfer';
  const connected = isZh ? '已连接' : 'Connected';
  const dropTitle = isZh ? '拖拽文件到这里上传' : 'Drag files here to upload';
  const dropHint = isZh ? '支持批量上传 · 或' : 'Batch upload · or ';
  const pickBtn = isZh ? '点击选择文件' : 'click to select files';
  const addedDesc = isZh ? '已添加到播放列表，可在 App 中查看' : 'Added to playlist, viewable in app';
  const lDone = isZh ? '传输完成，共 ' : 'Transfer complete, ';
  const lDoneFail = isZh ? '传输完成：' : 'Transfer complete: ';
  const lFiles = isZh ? ' 个文件' : ' files';
  const lOk = isZh ? ' 个成功，' : ' succeeded, ';
  const lFail = isZh ? ' 个失败' : ' failed';
  const htmlLang = isZh ? 'zh-CN' : 'en';

  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Music X - ${subtitle}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;
  background:#0a0a0f;color:#e2e2e8;min-height:100vh;
  display:flex;justify-content:center;padding:48px 20px;
}
.container{max-width:640px;width:100%}
.header{text-align:center;margin-bottom:44px}
.logo{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:6px}
.logo-dot{
  width:10px;height:10px;border-radius:50%;background:#6366f1;
  animation:glow 2s ease-in-out infinite alternate;
}
@keyframes glow{
  from{box-shadow:0 0 4px #6366f1,0 0 12px rgba(99,102,241,.3)}
  to{box-shadow:0 0 8px #6366f1,0 0 24px rgba(99,102,241,.5)}
}
.logo h1{font-size:24px;font-weight:700;letter-spacing:-.5px}
.subtitle{color:#555;font-size:13px;margin-top:2px}
.badge{
  display:inline-flex;align-items:center;gap:6px;
  background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.2);
  border-radius:20px;padding:6px 14px;margin-top:14px;font-size:13px;color:#4ade80;
}
.badge-dot{width:6px;height:6px;border-radius:50%;background:#4ade80}
.drop-zone{
  border:2px dashed #1e1e2e;border-radius:20px;padding:48px 24px;
  text-align:center;cursor:pointer;transition:all .3s ease;
  background:rgba(255,255,255,.01);position:relative;overflow:hidden;
}
.drop-zone::before{
  content:'';position:absolute;inset:0;
  background:radial-gradient(circle at center,rgba(99,102,241,.04) 0%,transparent 70%);
  pointer-events:none;
}
.drop-zone:hover,.drop-zone.dragover{border-color:#6366f1;background:rgba(99,102,241,.04)}
.drop-zone.dragover{transform:scale(1.005)}
.upload-icon{
  width:56px;height:56px;border-radius:16px;background:rgba(99,102,241,.1);
  display:flex;align-items:center;justify-content:center;
  margin:0 auto 16px;font-size:24px;
}
.drop-title{font-size:15px;font-weight:600;color:#ccc}
.drop-hint{font-size:13px;color:#555;margin-top:8px;line-height:1.5}
.drop-hint a{color:#6366f1;cursor:pointer;text-decoration:none}
.drop-hint a:hover{text-decoration:underline}
.formats{font-size:11px;color:#333;margin-top:16px}
.file-list{margin-top:20px}
.file-item{
  display:flex;align-items:center;gap:12px;
  background:rgba(255,255,255,.02);border:1px solid #1a1a24;
  border-radius:14px;padding:14px 16px;margin-bottom:8px;transition:all .3s;
}
.file-item.done{border-color:rgba(74,222,128,.15)}
.file-icon{
  width:36px;height:36px;border-radius:10px;
  display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;
}
.file-icon.music{background:rgba(99,102,241,.12)}
.file-icon.lyrics{background:rgba(251,191,36,.12)}
.file-info{flex:1;min-width:0}
.file-name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.file-meta{font-size:11px;color:#555;margin-top:2px}
.progress-track{width:100%;height:3px;background:#1a1a24;border-radius:2px;margin-top:6px;overflow:hidden}
.progress-bar{height:100%;border-radius:2px;background:linear-gradient(90deg,#6366f1,#818cf8);transition:width .2s;width:0%}
.file-status{font-size:12px;font-weight:600;flex-shrink:0;min-width:44px;text-align:right}
.s-up{color:#6366f1}.s-ok{color:#4ade80}.s-err{color:#f87171}
.summary{
  text-align:center;padding:32px;
  background:rgba(74,222,128,.03);border:1px solid rgba(74,222,128,.12);
  border-radius:20px;margin-top:24px;display:none;animation:fadeIn .5s ease;
}
.summary.show{display:block}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.sum-icon{font-size:40px;margin-bottom:8px}
.sum-title{font-size:17px;font-weight:700;color:#e2e2e8}
.sum-desc{font-size:13px;color:#555;margin-top:4px}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo"><div class="logo-dot"></div><h1>Music X</h1></div>
    <div class="subtitle">${subtitle}</div>
    <div class="badge"><div class="badge-dot"></div>${connected}</div>
  </div>
  <div class="drop-zone" id="dz">
    <div class="upload-icon">&#8593;</div>
    <div class="drop-title">${dropTitle}</div>
    <div class="drop-hint">${dropHint}<a id="pickBtn">${pickBtn}</a></div>
    <div class="formats">${platform === 'ios' ? 'MP3 · AIFF · OPUS · WAV · OGG · AAC · FLAC · M4A' : 'MP3 · OPUS · M4A · OGG · AAC · FLAC · WAV · WEBM'}</div>
  </div>
  <input type="file" id="fi" multiple accept="${platform === 'ios' ? '.mp3,.aiff,.opus,.wav,.ogg,.aac,.flac,.m4a,.lrc' : '.mp3,.opus,.m4a,.ogg,.aac,.flac,.wav,.webm,.lrc'}" hidden>
  <div class="file-list" id="fl"></div>
  <div class="summary" id="sum">
    <div class="sum-icon">&#10003;</div>
    <div class="sum-title" id="sumT"></div>
    <div class="sum-desc">${addedDesc}</div>
  </div>
</div>
<script>
var dz=document.getElementById('dz'),fi=document.getElementById('fi'),fl=document.getElementById('fl');
var pending=0,done=0,fail=0;
var lastProgressSent={};
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function fmt(b){if(b<1024)return b+' B';if(b<1048576)return(b/1024).toFixed(1)+' KB';return(b/1048576).toFixed(1)+' MB'}
function sendProgress(payload){
  try{
    fetch('/progress',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    }).catch(function(){});
  }catch(e){}
}
dz.addEventListener('dragover',function(e){e.preventDefault();dz.classList.add('dragover')});
dz.addEventListener('dragleave',function(){dz.classList.remove('dragover')});
dz.addEventListener('drop',function(e){e.preventDefault();dz.classList.remove('dragover');go(e.dataTransfer.files)});
document.getElementById('pickBtn').addEventListener('click',function(e){e.stopPropagation();fi.click()});
dz.addEventListener('click',function(){fi.click()});
fi.addEventListener('change',function(){go(fi.files);fi.value=''});
function go(files){document.getElementById('sum').classList.remove('show');for(var i=0;i<files.length;i++){pending++;send(files[i])}}
function send(file){
  var id='f'+Date.now()+Math.random().toString(36).substr(2,4);
  var ext=file.name.split('.').pop().toLowerCase();
  var isLrc=ext==='lrc';
  lastProgressSent[id]=-1;
  sendProgress({
    uploadId:id,
    filename:file.name,
    size:file.size,
    loaded:0,
    total:file.size,
    progress:0,
    status:'uploading'
  });
  var el=document.createElement('div');el.className='file-item';el.id=id;
  el.innerHTML='<div class="file-icon '+(isLrc?'lyrics':'music')+'">'+(isLrc?'\\uD83D\\uDCDD':'\\uD83C\\uDFB5')+'</div>'+
    '<div class="file-info"><div class="file-name">'+esc(file.name)+'</div>'+
    '<div class="file-meta">'+fmt(file.size)+'</div>'+
    '<div class="progress-track"><div class="progress-bar" id="'+id+'p"></div></div></div>'+
    '<div class="file-status s-up" id="'+id+'s">0%</div>';
  fl.prepend(el);
  var fd=new FormData();
  // URL-encode filename to survive NanoHTTPD's ISO-8859-1 parsing of multipart text fields
  fd.append('filename',encodeURIComponent(file.name));
  fd.append('file',file);
  var xhr=new XMLHttpRequest();
  xhr.upload.onprogress=function(e){
    if(e.lengthComputable){var p=Math.round(e.loaded/e.total*100);
      // Cap at 99% during upload, only show 100% after server confirms
      if(p>=100)p=99;
      document.getElementById(id+'p').style.width=p+'%';
      document.getElementById(id+'s').textContent=p+'%';
      if(lastProgressSent[id]!==p){
        lastProgressSent[id]=p;
        sendProgress({
          uploadId:id,
          filename:file.name,
          size:file.size,
          loaded:e.loaded,
          total:e.total,
          progress:p,
          status:'uploading'
        });
      }
    }
  };
  xhr.onload=function(){
    var bar=document.getElementById(id+'p'),st=document.getElementById(id+'s');
    if(xhr.status===200){done++;bar.style.width='100%';bar.style.background='#4ade80';
      st.textContent='\\u2713';st.className='file-status s-ok';document.getElementById(id).classList.add('done');
      sendProgress({
        uploadId:id,
        filename:file.name,
        size:file.size,
        loaded:file.size,
        total:file.size,
        progress:100,
        status:'done'
      });
    }else{fail++;st.textContent='\\u2717';st.className='file-status s-err'}
    pending--;chk();
  };
  xhr.onerror=function(){fail++;pending--;
    document.getElementById(id+'s').textContent='\\u2717';
    document.getElementById(id+'s').className='file-status s-err';
    sendProgress({
      uploadId:id,
      filename:file.name,
      size:file.size,
      loaded:0,
      total:file.size,
      progress:0,
      status:'error'
    });
    chk()
  };
  xhr.open('POST','/upload');xhr.send(fd);
}
window._L={done:'${lDone}',doneFail:'${lDoneFail}',files:'${lFiles}',ok:'${lOk}',fail:'${lFail}'};
function chk(){
  if(pending<=0&&(done+fail)>0){
    var s=document.getElementById('sum');s.classList.add('show');
    document.getElementById('sumT').textContent=fail>0
      ?window._L.doneFail+done+window._L.ok+fail+window._L.fail
      :window._L.done+done+window._L.files;
  }
}
</script>
</body>
</html>`;
}

import { Platform } from 'react-native';

export const WIFI_UPLOAD_HTML = getWifiUploadHtml('zh', Platform.OS);
