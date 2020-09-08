// ==UserScript==
// @name           豆瓣中图法分类
// @description    如果存在中图分类，则会在豆瓣信息栏中多显示如“中图分类: 中图分类: G442 (G 文化、 科学、 教育、 体育 ▸ G4 教育 ▸ G44 教育心理学 ▸ G442 学习心理学)；学科分类参考: 880 教育学 | 880 教育学 | 88027 教育心理学”，方便对图书进行分类。
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
// @version        0.2.2
// @icon           https://img3.doubanio.com/favicon.ico
// @run-at         document-end
// @namespace      http://018.ai
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
    'use strict';

    $(document).ready(function () {
        // 分类
        var info = $('#info');
        if (info && info.length > 0) {
            var isbns = /ISBN: .*\n/.exec(info.eq(0).text());
            if (isbns && isbns.length > 0) {
                var isbn = isbns[0].match(/\d+/g)[0].replace(/\n| /g, '');
                var title = $('#wrapper h1').eq(0).text().replace(/\n| /g, '');
                if( isbn && title ) {
                    // superlib 搜索
                    requestSuperlib(isbn);
                }
            }
        }

        if (localStorage.getItem("IsticKeys") == '0') {
            $('div.indent div.intro').eq(0).after('<p class="IsticKeys"><a class="ShowKeys" href="javascript:void();">(显示关键字)</a></p>');
            $('div.indent span.all div.intro').eq(0).after('<p class="IsticKeys"><a class="ShowKeys" href="javascript:void();">(显示关键字)</a></p>');
            $(".ShowKeys").click(function () {
                localStorage.setItem("IsticKeys", '1');
                location.reload();
            });
        } else {
            // 关键字
            let abstract = $('.indent .all .intro').eq(0).text();
            if (!abstract || abstract.length <= 0) {
                abstract = $('.indent .intro').eq(0).text();
            }

            // 目录
            let id = getIDFromURL(location.href);
            let dir = $('#dir_' + id + '_full').text();
            if (dir) {
                dir = dir.replace(/(([\xA0\s]*)\n([\xA0\s]*))+/g, '').replace('· · · · · ·     (收起)', '');
            }

            let content = abstract + dir;
            if (content.length > 0) {
                requestIstic(content);
            }
        }
    })

    function requestIstic(abstract) {
        let headers = {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Connection": "keep-alive",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4229.0 Safari/537.36",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Origin": "https://ct.istic.ac.cn",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
            "Referer": "https://ct.istic.ac.cn/site/term/participle",
            "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
            "Cookie": "name=value"
        }
        doPost('https://ct.istic.ac.cn/site/term/ceshihjson', headers, 'id=lyb018' + new Date().getTime() + '&inputText=' + encodeURIComponent(abstract), {}, function(json, responseDetail, meta) {
            if (json && json.t1 && json.t1.length > 0) {
                // 最多取五个
                let keys = [];
                json.t1.sort(function (a, b) {
                    return b.frequency - a.frequency;
                });
                for (let i = 0; i < json.t1.length; i++ ) {
                    let work = json.t1[i].word.trim();
                    if(work.length == 0 || ['第', '部分', '章', '●', 'Chapter', '-', '#', '附录'].includes(work)) continue;

                    keys.push('<span style="color:#EB9108">' + json.t1[i].word + '(' + json.t1[i].frequency + ')' + '</span>');

                    replaceKey(json.t1[i].word);

                    if (keys.length >= 5) break;
                }

                $('div.indent div.intro').eq(0).after('<p class="IsticKeys">关键字: ' + keys.join('<span style="color:#989B9B"> | </span>') + ' <a class="hideKeys" href="javascript:void();">(隐藏)</a></p>');
                $('div.indent span.all div.intro').eq(0).after('<p class="IsticKeys">关键字: ' + keys.join('<span style="color:#989B9B"> | </span>') + ' <a class="hideKeys" href="javascript:void();">(隐藏)</a></p>');
                $(".hideKeys").click(function () {
                    localStorage.setItem("IsticKeys", '0');
                    $('.IsticKeys').hide();
                    location.reload();
                });
            }
        }, function(err, meta) {
        });
    }

    function replaceKey(work) {
        for (let e of $('div.indent div.intro p')) {
            if (!e.querySelector('a')) {
                $(e).html($(e).html().replace(eval('/' + work + '/g'), '<span style="color:#EB9108">' + work + '</span>'));
            }
        }
    }

    // 请求图书馆联盟
    function requestSuperlib(isbn) {
        loadDoc('http://book.ucdrs.superlib.net/search?Field=all&channel=search&sw=' + isbn, {isbn: isbn}, function(doc, responseDetail, meta) {
            let found = false;
            let books = doc.querySelectorAll('.book1');
            if (books.length <= 0) {
                $('#info').append('<span class="pl">中图分类:</span> <span style="color:#989B9B">查无此信息</span>');
                return;
            }

            for (let book of books) {
                if (found) break;

                let a = book.querySelector('.book1 td>table a.px14');//
                if (a) {
                    // superlib 单本书籍查看
                    let url = a.href.replace(location.host, 'book.ucdrs.superlib.net').replace('https', 'http');
                    loadDoc(url, {isbn: meta.isbn}, function(doc1, responseDetail1, meta1) {
                        let tubox = doc1.querySelector('.tubox dl').textContent;
                        let isbn1 = opt(/【ISBN号】.*\n/.exec(tubox)).replace(/【ISBN号】|-|\n/g, '');
                        if (eqisbn(meta1.isbn, isbn1)) {
                            let clc = opt(opt(/【中图法分类号】.*\n/.exec(tubox)).match(/[a-zA-Z0-9\.]+/));
                            if (clc) {
                                found = $("#clcText").length > 0;
                                if (!found) {
                                    $('#info').append('<span class="pl">中图分类:</span> <a id="clc" target="_blank" href="https://www.clcindex.com/category/' + clc + '">'
                                                      + clc + '</a> <span id="clcText">(...)</span><br>');
                                    requestClc(clc);
                                }
                            }
                        }
                    }, function(err, meta) {
                        $('#info').append('<span class="pl">中图分类:</span> <span style="color:#989B9B">查无此信息</span>');
                    });
                }
            }
        }, function(err, meta) {
            $('#info').append('<span class="pl">中图分类:</span> <span style="color:#989B9B">查无此信息</span>');
        });
    }

    // 请求istic，获取分类名称，备用，暂不启用。
    function requestClc(clc) {
        doPost('https://ct.istic.ac.cn/site/clc/getByClassName?t=' + new Date().getTime(),
               { "Content-Type": "application/x-www-form-urlencoded" }, 'classname=' + clc, {clc: clc}, function(json, responseDetail, meta) {
            if (json.length == 0 && meta.clc.length > 0) {
                if (meta.clc.includes('.')) {
                    requestClc(meta.clc.replace(/\.\d*$/, ''));
                } else {
                    requestClc(meta.clc.replace(/\d$/, ''));
                }
                return;
            }

            let clcs = [];
            let jsonMap = {};
            let pid;

            let level;
            for (let i = 0; i < json.length; i ++) {
                if (clcs.length == 0 && json[i].classNum.split('/').includes(clc)) {
                    clcs.push(json[i].classNum + ' ' + hanldeClcText(json[i].className));

                    pid = json[i].pid;
                    level = json[i].level;
                } else if( json[i].level < level) {
                    jsonMap[json[i].id + ''] = json[i];
                }
            }

            clcText(pid, jsonMap, clcs);

            htmlclc(clcs);
        }, function(err, meta) {
            requestClcB(meta.clc);
        });
    }

    //  处理clc文字
    function clcText(pid, jsonMap, rets) {
        if (!jsonMap || !rets) return;

        if( jsonMap[pid] ) {
            rets.unshift(jsonMap[pid].classNum + ' ' + hanldeClcText(jsonMap[pid].className));

            if (jsonMap[pid].level <= 2) return;

            clcText(jsonMap[pid].pid, jsonMap, rets);
        }
    }

    function htmlclc(rets) {
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

    function hanldeClcText(txt) {
        var splits = txt.split(/、|（|）|\(|\)/);
        var retss = [];
        for (var s of splits) {
            if (s.length == 0) continue;

            retss.push(' <a target="_blank" href="http://xkfl.xhma.com/search?w=' + s + '">' + s + '</a>');

            requestxhma(s);
        }
        return retss.join('、');
    }

    // 请求clcindex，获取分类名称
    function requestClcB(clc) {
        var url = 'https://www.clcindex.com/category/' + clc;
        loadDoc(url, {clc: clc, url: url}, function(doc, responseDetail, meta) {
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

                clcs.push(clcCode + ' ' + hanldeClcText(txtContent));
            }

            $('#clc').attr('href', meta.url);
            htmlclc(clcs);
        }, function(err, meta) {
            if (err.status == 404) {
                if (meta.clc.includes('.')) {
                    requestClcB(meta.clc.replace(/\.\d*$/, ''));
                } else {
                    requestClcB(meta.clc.replace(/\d$/, ''));
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
    function requestxhma(s) {
        var url = 'http://xkfl.xhma.com/search?w=' + s;
        loadDoc(url, {}, function(doc, responseDetail, meta) {
            let spans = doc.querySelectorAll('.data li:not(.t) span');//code
            if (spans.length == 1) {
                let name = spans[0].nextElementSibling.textContent.trim();
                if (name.includes(s)) {
                    let code = spans[0].textContent.trim();
                    appendsubject(' <a target="_blank" href="' + spans[0].nextElementSibling.href + '">' + code + ' ' + name + '</a>');
                }
            } else if (spans.length > 1) {
                for (let span of spans) {
                    if (!span) continue;

                    let name = span.nextElementSibling.textContent.trim();
                    if (name != s && (name != s + '学')) continue;

                    let code = span.textContent.trim();

                    appendsubject('<a target="_blank" href="' + span.nextElementSibling.href + '">' + code + ' ' + name + '</a>');
                }
            }
        }, function(err, meta) {
        });
    }

    function appendsubject(subject) {
        let clcText = $('#subjectText');
        if (clcText.length == 0) {
            $('#info').append('<span class="pl">学科分类参考:</span> <span id="subjectText"><span>' + subject + '</span></span>');
        } else {
            clcText.append('<span style="color:#989B9B"> | </span><span>' + subject + '</span>');
        }
    }

    // 判断两个ISBN是否相等，如：9787100005586与7100005582，具体阅读：http://www.banquanye.com/article/id-812
    function eqisbn(val1, val2) {
        if (!val1 || (val1.length != 13 && val1.length != 10) || !val2 || (val2.length != 13 && val2.length != 10)) return false;

        let no1 = getISBNNo(val1);
        let no2 = getISBNNo(val2);
        return no1 == no2;
    }

    // 获取ID
    function getIDFromURL(url) {
        if (!url) return '';

        var id = url.match(/subject\/.*\//g);
        if (!id) return '';

        return id[0].replace(/subject|\//g, '');
    }

    // 获取ISBN的No，去掉前三位的978以及最后一位验证码
    function getISBNNo(val) {
        if (!val || (val.length != 13 && val.length != 10)) return;

        if (val.length == 13) {
            return val.substr(3, 9);
        } else if (val.length == 10) {
            return val.substr(0, 9);
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

// 测试URL：
// https://book.douban.com/subject/26431646/
// https://book.douban.com/subject/26298597/
// https://book.douban.com/subject/5402711/
