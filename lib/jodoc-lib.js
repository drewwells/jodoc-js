// a default html template
var default_template = '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">\n<html lang="en">\n<head>\n<meta http-equiv="Content-Type" content="text/html; charset=utf-8">\n<title>$title</title>\n<meta name="generator" content="joDoc">\n<link rel="stylesheet" type="text/css" href="docbody.css">\n<link rel="stylesheet" type="text/css" href="doc.css">\n<meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0, user-scalable=no, width=device-width">\n<meta name="format-detection" content="false">\n</head>\n<body>\n$body\n</body>\n</html>';

var external_regex = /(\<a)\s+(href="(?:http[s]?|mailto|ftp))/g,
    external_replace = '$1 class="external" $2',
    link_leadin = /(\W+)/,
    link_outtro = /(?!\<\/a|\w+)/;

// strip incoming text of comments
// input: "code"
// output: "comments"
function docker (input) {
	var strip_code = /\057\*\*(?:.|[\r\n])*?\*\057/gm;
	var strip_stars = /(\*\057|\057\*\*)/g;
	var strip_extra_whitespace = /([\r\n]+)\s/g;
	var output = [];
	var a;
	while ((a = strip_code.exec(input)) !== null)
	{
		a = a[0];
		a = a.replace(strip_stars,'');
		a = a.replace(strip_extra_whitespace, '$1');
		output.push(a);
	}
	return output.join("\n");
}

// add a nice header
// input: "body" | {body:"body", title:"title", template:"template"}
// output "templated html"
function html_header (body,title,template) {
	title = title || "joDoc";
	var output = template || default_template;
	output = output.replace(/\$title/g,title);
	output = output.replace(/\$body/g,body);
	return output;
}

// munge output filenames
// input: "full/path/to/file"
// output: "munged_file_name"
function munge_filename(file) {
	var path_parts = file.split("/");
	path_parts = path_parts.map(
		function(index) {
			return index.replace(/^\.+/g,"");
		}
	);
	path_parts = path_parts.filter(
		function(index){ return index !== "" }
	);
	return path_parts.join("_") + ".html";
}

// turn h1s into an index propertybag
// input: h1s
// output: "Stringified index"
function index_to_json (h1s) {
	var keywords = Object.keys(h1s).map(function(h1){ return {term:h1, url:h1s[h1]} });
	return JSON.stringify(keywords);
}

//Find all the files via filetype
function typeFinder( processed, obj ){

    var files = {},
        name,
        re = /\.([^.]+)\.html/g;

    obj = obj || {};

    for( var i = 0, l = processed.length; i < l; i++ ){

        if( (name = re.exec( processed[ i ].name) ) ){
            //match is second element in array
            name = name[ 1 ]; 
            if( ! obj[ name ] ){

                obj[ name ] = [];
            }
            obj[ name ].push( processed[ i ].name );
        }
    }
    return obj;
}

// find and return all the h1 tags in the processed files
// input: [{name:"filename", content:"file content"}]
// output: {index: {h1:file_name,...}, files: {filename:[h1s_in_file],...}}
function h1finder (processed) {
	var index = {};
	var files = {};
	var h1find = /\<h1\>([^\<]+)\<\/h1\>/g;
 
	processed.forEach(
		function(file_info) {
			var accum_h1s = [];
			var h1 = "";
			while ((h1 = h1find.exec(file_info.content)) !== null){
				accum_h1s.push(h1[1]);
			}
			accum_h1s.forEach(
				function (h1) {
					index[h1] = file_info.name;
				}
			);
			files[file_info.name] = accum_h1s;
		}
	);
    var ret = { index: typeFinder( processed, index ), files: files };
    return ret;
}

// make a nice index of the h1s
// input: h1s, outputdir = true | false
// output: "index html"
function indexer( h1s, outputdir ){

    var index = h1s.index,
        keywords = Object.keys( index ).sort( caseless_sort ),
        keyword_letters = {},
        letter,i,l,buffer;

    // format output markdown based on outputdir
    var formatter = function( keyword ){

        var ret = [];

        if( Array.isArray( index[ keyword ] ) ){

            for( var i = 0, l = index[ keyword ].length; i < l; i++ ){

	        if (outputdir) {
	            ret.push( '<li><a href="' + index[keyword][i] + '#' + index[keyword][i] + '">' + index[keyword][i] + '</a></li>' );
	        } else {
	            ret.push( '<li><a href="#' + index[keyword][i] + '">' + index[keyword][i] + '</a></li>' );
	        }
            }
            ret = ret.join('');
        } else {
	    if (outputdir) {
	        ret.push( '<li><a href="' + index[keyword] + '#' + keyword + '">' + keyword + '</a></li>' );
	    } else {
	        ret.push( '<li><a href="#' + keyword + '">' + keyword + '</a></li>' );
	    }
        }

        return ret;
    };

    //Expand any filetype lookups
    for( i = 0, l = keywords.length; i < l; i++ ){

        if( Array.isArray( index[ keywords[i] ] ) ){

            buffer = index[ keywords[i] ];
            buffer = buffer.map(function( n, i ){

                return !~keywords.indexOf( h1s.files[n][0] ) ? h1s.files[ n ][ 0 ] : undefined;
            });
            
            
            keywords = keywords.concat( buffer );
            delete keywords[ i ];
        }
    }

    // split keyword list into lettered segments
    for( i = 0, l = keywords.length; i < l; i++ ){

        if( keywords[i] ){

            letter = keywords[ i ].substring( 0, 1 ).toLocaleUpperCase();

            if( !keyword_letters[ letter ] ){

                keyword_letters[ letter ] = [];
            }
            keyword_letters[ letter ].push( formatter( keywords[ i ] ) );
        }
    }


    var keywords_marked = Object.keys(keyword_letters);
    keywords_marked = keywords_marked.map(function(letter) {
	var list_out = '<h2>' + letter + '</h2><ul>' + '\n';
	list_out += (keyword_letters[letter]).join("\n") + '</ul>';
	return list_out;
    });
    return '<h1>Index</h1>\n<span id="index">' + keywords_marked.join("\n") + '</span>';
}

// Take a TOC template and expand it
// toc_expander does the heavy lefting
// input: [toc.split], {name:file.name, content:file.content}
// optional input: /regex/ having two matches: $1 = indent, $2 = filename to find h1s in
// output: Markdown ready TOC
function toclinker(toc, files, toc_regex) {
    var tocline = toc_regex || /(\s*).\s*{(.+)}/, tocline_res;
    var h1stuff = h1finder(files);

    var toclinked = [];
    toc.forEach(function(line) {
	if ((tocline_res = tocline.exec(line)) != null) {
	    line = toc_expander(h1stuff, tocline_res[1], tocline_res[2]);

	}
	toclinked.push(line);
    });

    return toclinked.join('\n');
}

// Expand {} placeholders in table of contents
// input: {h1s, files}, indent before '{}', interior of toc '{}' line
// output: markdown list of matching h1s
function toc_expander(h1bag, indent, pathpart) {
	var files = h1bag.files;
	var matching_files = Object.keys(files), matching_h1s = [];
	matching_files = matching_files.filter(function (file){ return file.match(pathpart) });
	matching_files.forEach(function (matching_file){
		matching_h1s = matching_h1s.concat(files[matching_file]);
	});
	matching_h1s = matching_h1s.sort(caseless_sort).map(function(matching_h1) {
		return indent + '* ' + matching_h1;
	});
	return matching_h1s.join("\n").replace(/\_/g,"\\_");
}

// link keywords to their h1 tags
// input: ([files], [h1s])
// output: [linked_files]
function autolink( files, h1s, output) {

    var i, l, content, input,

        keywords = Object.keys(h1s)
        .sort()
        .reverse()
        .map(function( kw ){

            return kw.replace(/\s/g,"\\s");
        });

    if( !keywords.length ) { return files; }

    var keys = '\\[(' + keywords.join("|") + ')\\]',
        re = new RegExp(link_leadin.source + keys + link_outtro.source, 'g');

    for (i = 0, l = files.length; i < l; i++) {
	input = files[i].content;
	input = input.replace(external_regex, external_replace);
	if (output) {
	    input = input.replace( re, function( _, m1, m2 ) {
		return m1+'<a href="'+h1s[m2]+'#'+m2+'">'+m2+'<\/a>';
	    });
	    input = input.replace(/\<h1\>\<a href="[^\#\>]*#/g,'<h1><a name="');
	} else {
	    input = input.replace(re, function( _, m1, m2 ){
		return m1+'<a href="' + '#' + m2 + '">' + m2 + '<\/a>';
	    });
	    input = input.replace(/\<h1\>\<a href="#/g,'<h1><a name="');
	}
	files[i].content = input;
    }
    return files;
}

function caseless_sort (a,b) {
	if (typeof a !== "string" || typeof b !== "string") {
		return 0;
	}
	return a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase());
};

exports.docker = docker;
exports.html_header = html_header;
exports.munge_filename = munge_filename;
exports.h1finder = h1finder;
exports.indexer = indexer;
exports.toclinker = toclinker;
exports.autolink = autolink;
