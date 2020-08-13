// ==UserScript==
// @name           豆瓣中图法分类
// @description    感谢葛大(公众号：葛仲然)的知识营，让我认识了很多好工具和优秀的人。
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
// @include        https://book.douban.com/*
// @version        0.1
// @icon           https://img3.doubanio.com/favicon.ico
// @run-at         document-end
// @namespace      doveboy_js
// ==/UserScript==

// This Userscirpt can't run under Greasemonkey 4.x platform
if (typeof GM_xmlhttpRequest === 'undefined') {
    alert('不支持Greasemonkey 4.x，请换用暴力猴或Tampermonkey')
    return
}

// 不属于豆瓣的页面
if (!/douban.com/.test(location.host)) {
    return
}

;(function () {
    'use strict'

    $(document).ready(function () {
        var isbn = /ISBN: .*\n/.exec($('#info').eq(0).text())[0].match(/\d+/g)[0].replace(/\n| /g, '');
        var title = $('#wrapper h1').eq(0).text().replace(/\n| /g, '');
        if( isbn && title ) {
            getDoc('http://book.ucdrs.superlib.net/search?Field=all&channel=search&sw=' + isbn, null, function(doc, responseDetail, meta) {
                for (let book of doc.querySelectorAll('.book1')) {
                    let a = book.querySelector('.book1 td>table a.px14');
                    if (a && a.textContent.includes(title)) {
                        let url = a.href.replace(location.host, 'book.ucdrs.superlib.net').replace('https', 'http');
                        getDoc(url, null, function(doc1, responseDetail, meta) {
                            let val = /【中图法分类号】.*\n/.exec(doc1.querySelector('.tubox dl').textContent)[0].match(/[a-zA-Z0-9\.]+/)[0];
                            if (val) {
                                getDoc('https://www.clcindex.com/search/?wd=' + val, null, function(doc2, responseDetail, meta) {
                                    let found = false;
                                    if (doc2) {
                                        let aa = doc2.querySelector('#catTable tbody>tr a');
                                        if (aa) {
                                            found = true;
                                            $('#info').append('<span class="pl">中图分类:</span> <a target="_blank" href="https://www.clcindex.com/search/?wd=' + val + '">' + val + '</a> (' + aa.textContent + ')');
                                        }
                                    }

                                    if (!found) {
                                        $('#info').append('<span class="pl">中图分类:</span> <a target="_blank" href="https://www.clcindex.com/search/?wd=' + val + '">' + val + '</a>');
                                    }
                                });
                            }
                        });
                    }
                }
            });
        }
    })

    // 对使用GM_xmlhttpRequest返回的html文本进行处理并返回DOM树
    function page_parser(responseText) {
        // 替换一些信息防止图片和页面脚本的加载，同时可能加快页面解析速度
        responseText = responseText.replace(/s+src=/ig, ' data-src='); // 图片，部分外源脚本
        responseText = responseText.replace(/<script[^>]*?>[\S\s]*?<\/script>/ig, ''); //页面脚本
        return (new DOMParser()).parseFromString(responseText, 'text/html');
    }

    function getDoc (url, meta, callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            onload: function (responseDetail) {
                if (responseDetail.status === 200) {
                    let doc = page_parser(responseDetail.responseText)
                    callback(doc, responseDetail, meta)
                } else {
                    callback(undefined, responseDetail, meta)
                }
            }
        })
    }
})()
