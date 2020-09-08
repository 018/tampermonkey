// ==UserScript==
// @name           全国图书馆参考咨询联盟
// @description    下载DPF少操作一步，「文章下载」替换成「PDF下载」，点击直接下载。也可辅助Zotero translator的Superlib.js，直接抓取PDF。
// @author         018(lyb018@gmail.com)
// @contributor    Rhilip
// @connect        *
// @grant          GM_xmlhttpRequest
// @grant          GM_setClipboard
// @grant          GM_addStyle
// @grant          GM_setValue
// @grant          GM_getValue
// @grant          GM_listValues
// @grant          GM_deleteValue
// @grant          GM_registerMenuCommand
// @require        https://cdnjs.cloudflare.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require        https://greasyfork.org/scripts/368137-encodeToGb2312/code/encodeToGb2312.js?version=601683
// @include        http://jour.ucdrs.superlib.net/*
// @include        http://book.ucdrs.superlib.net/views/specific/*
// @version        0.1.1
// @run-at         document-end
// @namespace      http://018.ai
// ==/UserScript==

// This Userscirpt can't run under Greasemonkey 4.x platform
if (typeof GM_xmlhttpRequest === 'undefined') {
    alert('不支持Greasemonkey 4.x，请换用暴力猴或Tampermonkey')
    return
}

// 不属于的页面
if (!/ucdrs.superlib.net/.test(location.host)) {
    return
}

;(function () {
    'use strict';

    $(document).ready(function () {
        if (location.href.includes('book.ucdrs.superlib.net/views/specific')) {
            // 中图分类
            for(let dd of $('.tubox dl dd')) {
                if (dd.textContent.startsWith('【中图法分类号】')) {
                    let clc = opt(opt(/【中图法分类号】.*/.exec(dd.textContent)).match(/[a-zA-Z0-9\.]+/));
                    $(dd).html(dd.textContent.replace(clc, '<a id="clc" target="_blank" href="https://www.clcindex.com/category/' + clc + '">' + clc + '</a>') + ' <span id="clcText">(...)</span>');
                    requestClc(clc, dd);
                } else if (dd.textContent.startsWith('【ISBN号】')) {
                    let title = $('.tutilte').text();
                    let isbn = opt(/【ISBN号】.*/.exec(dd.textContent)).replace(/【ISBN号】|-|\n/g, '');

                    let intervalID = setInterval(function() {
                        requestBOK(title, isbn);
                        clearInterval(intervalID);
                    }, 1000);
                }
            }
        } else if (location.href.includes('jour.ucdrs.superlib.net/views/specific')) {
            // 文章下载
            var as = $('.link a');
            if (as.length > 0) {
                loadHref(as.get(0));
            }
        } else if (location.href.includes('jour.ucdrs.superlib.net/searchJour')) {
            // 文章下载
            for (var a of $('.book1 .get a')) {
                if (a.textContent != '文章下载') continue;

                loadHref(a);
            }
        }
    })

    // 加载PDF页面
    function loadHref(a) {
        loadDoc(a.href, {a: a}, function(doc, responseDetail, meta) {
            var download = doc.querySelector('.download .down_bnt');
            if (download) {
                replaceHref($(meta.a), download.href)
            }
        });
    }

    // 替换href
    function replaceHref($a, pdfurl) {
        $a.attr('href', pdfurl);
        $a.html('PDF下载');
    }

    // 请求电子书
    function requestBOK(title, isbn) {
        $('#libinfo .title').after($('<div class="box"><h3 class="boxHd">电子书 </h3><div class="link" id="download"><span style="color:#989B9B">(...)</span></div></div>'));
        loadDoc('https://b-ok.global/s/' + isbn, {title: title, isbn: isbn}, function(doc, responseDetail, meta) {
            let found = false;
            for (let a of doc.querySelectorAll('table.resItemTable h3[itemprop=name] a')) {
                if (a.textContent.includes(meta.title) || meta.title.includes(a.textContent)) {
                    let url = a.href.replace(location.host, 'b-ok.global').replace('http:', 'https:');
                    found = true;
                    loadDoc(url, {}, function(doc, responseDetail, meta) {
                        let addDownloadedBook = doc.querySelector('.addDownloadedBook');
                        if (addDownloadedBook) {
                            let txt = addDownloadedBook.textContent.match(/\(.*\)/g);
                            url = addDownloadedBook.href.replace(location.host, 'b-ok.global').replace('http:', 'https:');
                            $('#download').html('<a target="_blank" href="' + url + '">下载' + txt + '</a>');
                        } else {
                            $('#download').html('<span style="color:#989B9B"> 暂无资源 </span>');
                        }
                    }, function(err, meta) {
                        $('#download').html('<span style="color:#989B9B"> 暂无资源 </span>');
                    });
                }
            }

            if (!found) {
                $('#download').html('<span style="color:#989B9B"> 暂无资源 </span>');
            }
        }, function(err, meta) {
            $('#download').html('<span style="color:#989B9B"> 暂无资源 </span>');
        });
    }

    // 请求istic，获取分类名称，备用，暂不启用。
    function requestClc(clc, dd) {
        doPost('https://ct.istic.ac.cn/site/clc/getByClassName?t=' + new Date().getTime(),
               { "Content-Type": "application/x-www-form-urlencoded" }, 'classname=' + clc, {dd: dd, clc: clc}, function(json, responseDetail, meta) {
            if (json.length == 0 && meta.clc.length > 0) {
                if (meta.clc.includes('.')) {
                    requestClc(meta.clc.replace(/\.\d*$/, ''), meta.dd);
                } else {
                    requestClc(meta.clc.replace(/\d$/, ''), meta.dd);
                }
                return;
            }

            let clcs = [];
            let jsonMap = {};
            let pid;

            let level;
            for (let i = 0; i < json.length; i ++) {
                if (clcs.length == 0 && json[i].classNum.split('/').includes(clc)) {
                    clcs.push(json[i].classNum + ' ' + hanldeClcText(json[i].className, meta.dd));

                    pid = json[i].pid;
                    level = json[i].level;
                } else if( json[i].level < level) {
                    jsonMap[json[i].id + ''] = json[i];
                }
            }

            clcText(pid, jsonMap, clcs, meta.dd);

            htmlclc(clcs, meta.dd);
        }, function(err, meta) {
            requestClcB(meta.clc, meta.dd);
        });
    }

    //  处理clc文字
    function clcText(pid, jsonMap, rets, dd) {
        if (!jsonMap || !rets) return;

        if( jsonMap[pid] ) {
            rets.unshift(jsonMap[pid].classNum + ' ' + hanldeClcText(jsonMap[pid].className, dd));

            if (jsonMap[pid].level <= 2) return;

            clcText(jsonMap[pid].pid, jsonMap, rets, dd);
        }
    }

    function htmlclc(rets, dd) {
        if (rets.length > 0) {
            let clcText = $('#clcText');
            if (clcText.text() == '(...)' ) {
                clcText.html('(' + rets.join('<span style="color:#989B9B"> ▸ </span>') + ')');
            }
        } else {
            let clcText = $('#clcText');
            if (clcText.text() == '(...)' ) {
                clcText.html('<span style="color:#989B9B">(查无此信息)</span>');
            }
        }
    }

    function hanldeClcText(txt, dd) {
        var splits = txt.split(/、|（|）|\(|\)/);
        var retss = [];
        for (var s of splits) {
            if (s.length == 0) continue;

            retss.push(' <a target="_blank" href="http://xkfl.xhma.com/search?w=' + s + '">' + s + '</a>');

            requestxhma(s, dd);
        }
        return retss.join('、');
    }

    // 请求clcindex，获取分类名称
    function requestClcB(clc, dd) {
        var url = 'https://www.clcindex.com/category/' + clc;
        loadDoc(url, {dd: dd, clc: clc, url: url}, function(doc, responseDetail, meta) {
            let clcs = [];
            for (let li of doc.querySelectorAll('.breadcrumb li.active')) {
                if (!li) continue;

                var txtContent = li.textContent.trim();
                var clcCode;
                var index = txtContent.indexOf(' ');
                if (index > 0) {
                    clcCode = txtContent.substr(0, index);
                    txtContent = txtContent.substr(index + 1);
                }

                clcs.push(clcCode + ' ' + hanldeClcText(txtContent, meta.dd));
            }

            $('#clc').attr('href', meta.url);
            htmlclc(clcs);
        }, function(err, meta) {
            if (err.status == 404) {
                if (meta.clc.includes('.')) {
                    requestClcB(meta.clc.replace(/\.\d*$/, ''), meta.dd);
                } else {
                    requestClcB(meta.clc.replace(/\d$/, ''), meta.dd);
                }
                return;
            }

            let clcText = $('#clcText');
            if (clcText.text() == '(...)' ) {
                clcText.html('<span style="color:#989B9B">(无法获取)</span>');
            }
        });

    }

    // 请求xhma，获取学科
    function requestxhma(s, dd) {
        var url = 'http://xkfl.xhma.com/search?w=' + s;
        loadDoc(url, {dd: dd}, function(doc, responseDetail, meta) {
            let spans = doc.querySelectorAll('.data li:not(.t) span');//code
            if (spans.length == 1) {
                let name = spans[0].nextElementSibling.textContent.trim();
                if (name.includes(s)) {
                    let code = spans[0].textContent.trim();
                    appendsubject(' <a target="_blank" href="' + spans[0].nextElementSibling.href + '">' + code + ' ' + name + '</a>', meta.dd);
                }
            } else if (spans.length > 1) {
                for (let span of spans) {
                    if (!span) continue;

                    let name = span.nextElementSibling.textContent.trim();
                    if (name != s && (name != s + '学')) continue;

                    let code = span.textContent.trim();

                    appendsubject('<a target="_blank" href="' + span.nextElementSibling.href + '">' + code + ' ' + name + '</a>', meta.dd);
                }
            }
        }, function(err, meta) {
        });
    }

    function appendsubject(subject, dd) {
        let clcText = $('#subjectText');
        if (clcText.length == 0) {
            $(dd).after($('<dd >【学科分类参考】<span id="subjectText"><span>' + subject + '</span></span></dd>'));
        } else {
            clcText.append('<span style="color:#989B9B"> | </span><span>' + subject + '</span>');
        }
    }

    // 判断，空返回空字符串
    function opt(val) {
        if (!val) return '';

        if (val instanceof Array) {
            if (val.length > 0) {
                return val[0];
            }
        } else {
            return val;
        }
    }

    // 对使用GM_xmlhttpRequest返回的html文本进行处理并返回DOM树
    function page_parser(responseText) {
        // 替换一些信息防止图片和页面脚本的加载，同时可能加快页面解析速度
        responseText = responseText.replace(/s+src=/ig, ' data-src='); // 图片，部分外源脚本
        responseText = responseText.replace(/<script[^>]*?>[\S\s]*?<\/script>/ig, ''); //页面脚本
        return (new DOMParser()).parseFromString(responseText, 'text/html');
    }

    // 加载网页
    function loadDoc (url, meta, callback, fail) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            onload: function (responseDetail) {
                if (responseDetail.status === 200) {
                    let doc = page_parser(responseDetail.responseText)
                    callback(doc, responseDetail, meta)
                } else if (fail){
                    fail(responseDetail, meta);
                }
            },
            onerror: function(err) {
                if (fail) {
                    fail(err, meta);
                }
            }
        })
    }

    // get请求
    function doGet (url, meta, callback, fail) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            onload: function (responseDetail) {
                if (responseDetail.status === 200) {
                    callback(JSON.parse(responseDetail.responseText), responseDetail, meta)
                } else if (fail){
                    fail(responseDetail, meta);
                }
            },
            onerror: function(err) {
                if (fail) {
                    fail(err, meta);
                }
            }
        })
    }

    // post请求
    function doPost (url, headers, data, meta, callback, fail) {
        GM_xmlhttpRequest({
            method: "POST",
            url: url,
            data: data,
            headers: headers,
            onload: function(responseDetail){
                if (responseDetail.status === 200) {
                    callback(JSON.parse(responseDetail.responseText), responseDetail, meta)
                } else if (fail){
                    fail(responseDetail, meta);
                }
            },
            onerror: function(err) {
                if (fail) {
                    fail(err, meta);
                }
            }
        })
    }
})()

// 测试URL
// http://jour.ucdrs.superlib.net/searchJour?sw=%E6%85%A2%E6%80%A7&allsw=%23%2Call%E9%95%BF%E6%97%B6&bCon=&ecode=utf-8&channel=searchJour&Field=all
