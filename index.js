var postcss = require('postcss');


function replaceRight(str_whole, regexp_to_match, func_to_replace){
    var index_end = str_whole.length
    var arr_last_match = null
    while(true)
    {
        arr_last_match = null
        arr_next_match = null
        var index_start = 0
        while (true)
        {
            str_part = str_whole.substring(index_start,index_end)
            // console.log(str_part)
            arr_next_match = regexp_to_match.exec(str_part)

            // console.log(arr_next_match)
            if (arr_next_match === null)
            {
                // console.log("breaking")
                break;
            }
            else
            {
                arr_last_match = arr_next_match
                arr_last_match.index_start = index_start
                index_start = index_start + arr_last_match[0].length
            }
        }
        if (arr_last_match === null)
        {
            return str_whole;
        }
        else
        {
            // console.log(arr_last_match, arr_last_match.index_start)
            index_end = arr_last_match.index_start + arr_last_match.index
            extra_string_info= {"str":str_whole, "match_start":index_start,"match_end":index_end, "type":"extra_string_info"}
            replaced_str = func_to_replace.apply(null, [].concat(arr_last_match).concat([arr_last_match.index,arr_last_match.input,extra_string_info]))
            str_whole = str_whole.substring(0, index_end ) + replaced_str + str_whole.substring(index_end + arr_last_match[0].length)
            // console.log(str_whole)
        }
    }
}


var definition = function (variables, node) {
    var name = node.prop.slice(1);
    variables[name] = node.value;
    // console.log(node.value)
    node.remove();
};

var variable = function (variables, node, str, name, index, opts, result) {
    if ( opts.only ) {
        if ( typeof opts.only[name] !== 'undefined' ) {
            return opts.only[name];
        } else {
            return str;
        }

    } if ( typeof variables[name] !== 'undefined' ) {
        var tmp_var = variables[name]
        // console.log(tmp_var, typeof(tmp_var), index, typeof(index))
        if (index === undefined)
        {
            return tmp_var;
        }
        else
        {
            index = Number(index);
            console.log(index);
            tmp_var = JSON.parse(tmp_var)
            return tmp_var[index];
        }

    } else if ( opts.silent ) {
        return str;

    } else {
        var fix = opts.unknown(node, name, result);
        if ( fix ) {
            return fix;
        } else {
            return str;
        }
    }
};

var simpleSyntax = function (variables, node, str, opts, result) {
    return replaceRight(str,/\$([\w\d-_]+)(?:\[(\d+)\])?/, function (_, name, index) {
        console.log("simple", name)
        // console.log(index)

        /* catch case of $arr[$i], as ori replaceright doesnt catch $i in str to match */
        var extra_string_info = arguments[arguments.length - 1]
        console.assert(extra_string_info.type == "extra_string_info")
        var str_whole = extra_string_info.str
        var str_whole_length = str_whole.length
        var str_unmatched_right = str_whole.substring(extra_string_info.index_end, str_whole_length)
        console.log(str_unmatched_right)
        var regexp_index_only = /^\[(\d+)\]/
        var matches_index = regexp_index_only.exec(str_unmatched_right)
        if (matches_index !== null)
        {
            index = matches_index[1]
            console.log(index)
        }

        return variable(variables, node, '$' + name, name, index, opts, result);
    });
};

var inStringSyntax = function (variables, node, str, opts, result) {
    return replaceRight(str,/\$\(\s*([\w\d-_]+)(?:\[(\d+)\])?\s*\)/, function (all, name, index) {
        // console.log("in", all, name)
        // console.log(index)
        return variable(variables, node, all, name, index, opts, result);
    });
};

var bothSyntaxes = function (variables, node, str, opts, result) {
    str = simpleSyntax(variables, node, str, opts, result);
    str = inStringSyntax(variables, node, str, opts, result);
    return str;
};

var declValue = function (variables, node, opts, result) {
    node.value = bothSyntaxes(variables, node, node.value, opts, result);
};

var ruleSelector = function (variables, node, opts, result) {
    node.selector = bothSyntaxes(variables, node, node.selector, opts, result);
};

var atruleParams = function (variables, node, opts, result) {
    node.params = bothSyntaxes(variables, node, node.params, opts, result);
};

module.exports = postcss.plugin('postcss-simple-vars', function (opts) {
    if ( typeof opts === 'undefined' ) opts = { };

    if ( !opts.unknown ) {
        opts.unknown = function (node, name) {
            throw node.error('Undefined variable $' + name);
        };
    }

    return function (css, result) {
        var variables = { };
        if ( typeof opts.variables === 'function' ) {
            variables = opts.variables();
        } else if ( typeof opts.variables === 'object' ) {
            for ( var i in opts.variables ) variables[i] = opts.variables[i];
        }

        css.walk(function (node) {

            if ( node.type === 'decl' ) {
                if ( node.value.toString().indexOf('$') !== -1 ) {
                    declValue(variables, node, opts, result);
                }
                if ( node.prop[0] === '$' ) {
                    if ( !opts.only ) definition(variables, node);
                }

            } else if ( node.type === 'rule' ) {
                if ( node.selector.indexOf('$') !== -1 ) {
                    ruleSelector(variables, node, opts, result);
                }

            } else if ( node.type === 'atrule' ) {
                if ( node.params && node.params.indexOf('$') !== -1 ) {
                    atruleParams(variables, node, opts, result);
                }
            }

        });
    };
});
