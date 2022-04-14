import { expect } from 'chai';
import { deepGet } from '../../parsers/utils';
import { preprocess } from '../print-preprocess';
import { LiquidParserOptions } from '../utils';
import { NodeTypes, toLiquidHtmlAST } from '../../parsers';
import { DocumentNode, LiquidHtmlNode } from './types';

describe('Module: augmentWithWhitespaceHelpers', () => {
  let ast: DocumentNode;

  describe('Unit: isTrailingWhitespaceSensitive', () => {
    it('should return false when the next node is whitespace stripping to the left', () => {
      const firstChilds = [
        'hello',
        '{{ drop }}',
        '{% if true %}hello{% endif %}',
        '{% echo "hello" %}',
      ];
      const secondChilds = [
        '{{- drop }}',
        '{%- if true %}world{% endif %}',
        '{%- assign x = true %}',
      ];
      for (const left of firstChilds) {
        for (const right of secondChilds) {
          ast = toAugmentedAst(`<p>${left} ${right}</p>`);
          expectPath(ast, 'children.0.type').to.eql(NodeTypes.HtmlElement);
          expectPath(ast, 'children.0.children.0.isTrailingWhitespaceSensitive').to.be.false;
        }
      }
    });

    it('should return false when the node is whitespace stripping to the right', () => {
      const firstChilds = [
        '{{ drop -}}',
        '{% if true %}world{% endif -%}',
        '{% form %}...{% endform -%}',
        '{% assign x = true -%}',
      ];
      const secondChilds = [
        'hello',
        '{{ drop }}',
        '{% if true %}hello{% endif %}',
        '{% assign x = true %}',
      ];
      for (const left of firstChilds) {
        for (const right of secondChilds) {
          ast = toAugmentedAst(`<p>${left} ${right}</p>`);
          expectPath(ast, 'children.0.children.0.isTrailingWhitespaceSensitive').to.be.false;
        }
      }
    });

    it('should return true when an inline formatting context is implied because the next node is a text node', () => {
      ast = toAugmentedAst('<p>hello {{ drop }}</p>');
      expectPath(ast, 'children.0.children.0.isTrailingWhitespaceSensitive').to.be.true;

      ast = toAugmentedAst('<p>{{ drop }}hello</p>');
      expectPath(ast, 'children.0.children.0.isTrailingWhitespaceSensitive').to.be.true;
    });

    it('should return false when a block formatting context is implied because of the current node', () => {
      ast = toAugmentedAst('<p><div>hello</div> {{ drop }}</p>');
      expectPath(ast, 'children.0.children.0.isTrailingWhitespaceSensitive').to.be.false;
    });

    it('should return false for the document node', () => {
      ast = toAugmentedAst('');
      expectPath(ast, 'isTrailingWhitespaceSensitive').to.be.false;
    });

    it('should return false for display none elements', () => {
      ast = toAugmentedAst('<datalist><option value="hello world" /></datalist>');
      expectPath(ast, 'children.0.isTrailingWhitespaceSensitive').to.be.false;
    });

    it('should return true for child nodes of pre-like nodes', () => {
      const wrappers = [
        ['<pre>', '</pre>'],
        ['<textarea>', '</textarea>'],
        ['<plaintext>', '</plaintext>'],
      ];
      const nodes = [
        'hello world',
        '{{ drop }}',
        '{% if true %}world{% endif %}',
        '{% form %}...{% endform %}',
        '{% assign x = true %}',
      ];

      for (const [wrapStart, wrapEnd] of wrappers) {
        for (const node of nodes) {
          ast = toAugmentedAst(`${wrapStart}${node} ${wrapEnd}`);
          expectPath(ast, 'children.0.children.0.isTrailingWhitespaceSensitive').to.be.true;
        }
      }
    });

    describe('When: the node is the last children of its parent', () => {
      it('should return false for direct children of the document', () => {
        ast = toAugmentedAst('{{ drop1 }} {{ drop }}');
        expectPath(ast, 'children.1.isTrailingWhitespaceSensitive').to.be.false;
      });

      it('should return false for pre-like nodes', () => {
        ast = toAugmentedAst('{% form %}hello <pre> ... </pre> {% endform %}');
        expectPath(ast, 'children.0.children.1.isTrailingWhitespaceSensitive').to.be.false;
      });

      it('should return false for last child of block ', () => {
        ast = toAugmentedAst('<p>hello <span>world</span> </p>');
        expectPath(ast, 'children.0.children.1.isTrailingWhitespaceSensitive').to.be.false;
      });

      it('should return false if the parent is trimming to the inner right', () => {
        ast = toAugmentedAst('{% if true %}branch a{%- else %}branch b{% endif %}');
        expectPath(ast, 'children.0.children.0.type').to.eql(NodeTypes.LiquidBranch);
        expectPath(ast, 'children.0.children.0.name').to.eql(null);
        expectPath(ast, 'children.0.children.0.children.0.isTrailingWhitespaceSensitive').to.be
          .false;

        ast = toAugmentedAst('{% if true %}branch a{% else %}branch b{%- endif %}');
        expectPath(ast, 'children.0.children.1.type').to.eql(NodeTypes.LiquidBranch);
        expectPath(ast, 'children.0.children.1.name').to.eql('else');
        expectPath(ast, 'children.0.children.1.children.0.isTrailingWhitespaceSensitive').to.be
          .false;

        ast = toAugmentedAst('{% form %}branch a{%- endform %}');
        expectPath(ast, 'children.0.children.0.isTrailingWhitespaceSensitive').to.be.false;
      });
    });

    it('should return false if the next child is not whitespace sensitive to the outer left', () => {
      ast = toAugmentedAst('<p>Hello <div> world </div></p>');
      expectPath(ast, 'children.0.children.0.type').to.eql(NodeTypes.TextNode);
      expectPath(ast, 'children.0.children.0.isTrailingWhitespaceSensitive').to.be.false;
    });
  });

  describe('Unit: isLeadingWhitespaceSensitive', () => {
    it('should return true when this node and the prev imply an inline formatting context', () => {
      const nodes = ['<span>hello</span>', '{{ drop }}', '{% if true %}hello{% endif %}'];

      for (const left of nodes) {
        for (const right of nodes) {
          ast = toAugmentedAst(`<p>${left} ${right}</p>`);
          expectPath(ast, 'children.0.children.1.isLeadingWhitespaceSensitive', `${left} ${right}`)
            .to.be.true;
        }
      }
    });

    it('should return false when this node is whitespace stripping to the left', () => {
      const firstChilds = ['hello', '{{ drop }}', '{% if true %}hello{% endif %}'];
      const secondChilds = ['{{- drop }}', '{%- echo "world" %}', '{%- if true %}hello{% endif %}'];
      for (const left of firstChilds) {
        for (const right of secondChilds) {
          ast = toAugmentedAst(`<p>${left} ${right}</p>`);
          expectPath(ast, 'children.0.children.1.isLeadingWhitespaceSensitive').to.be.false;
        }
      }
    });

    it('should return false when the previous node is whitespace stripping to the right', () => {
      const firstChilds = ['{{ drop -}}', '{% echo "world" -%}', '{% if true %}hello{% endif -%}'];
      const secondChilds = ['hello', '{{ drop }}', '{% if true %}hello{% endif %}'];
      for (const left of firstChilds) {
        for (const right of secondChilds) {
          ast = toAugmentedAst(`<p>${left} ${right}</p>`);
          expectPath(ast, 'children.0.children.1.isLeadingWhitespaceSensitive', `${left} ${right}`)
            .to.be.false;
        }
      }
    });

    it('should return false for the document node', () => {
      ast = toAugmentedAst('');
      expectPath(ast, 'isLeadingWhitespaceSensitive').to.be.false;
    });

    it('should return false for display none elements', () => {
      ast = toAugmentedAst('<datalist><option value="hello world" /></datalist>');
      expectPath(ast, 'children.0.isLeadingWhitespaceSensitive').to.be.false;
    });

    describe('When: the node is the first child', () => {
      it('should return false when its parent is the DocumentNode', () => {
        ast = toAugmentedAst('<p></p>');
        expectPath(ast, 'children.0.isLeadingWhitespaceSensitive').to.be.false;
      });

      it('should return false when it is pre-like', () => {
        ast = toAugmentedAst('<span> <pre></pre></span>');
        expectPath(ast, 'children.0.children.0.isLeadingWhitespaceSensitive').to.be.false;
      });

      it('should return false if the parent strips whitespace from both ends', () => {
        const nodes = [
          'hello',
          '<span>hello</span>',
          '{{ drop }}',
          '{% if true %}hello{% endif %}',
        ];
        for (const node of nodes) {
          ast = toAugmentedAst(`<p> ${node} </p>`);
          expectPath(ast, 'children.0.children.0.isLeadingWhitespaceSensitive').to.be.false;
        }
      });

      it('should return false if the parent is whitespace stripping to the inner right', () => {
        const nodes = [
          'hello',
          '<span>hello</span>',
          '{{ drop }}',
          '{% if true %}hello{% endif %}',
        ];
        for (const node of nodes) {
          ast = toAugmentedAst(`{% form -%} ${node} {% endform %}`);
          expectPath(ast, 'children.0.children.0.isLeadingWhitespaceSensitive').to.be.false;

          ast = toAugmentedAst(`{% if A -%} ${node} {% endif %}`);
          expectPath(ast, 'children.0.children.0.type').to.eql(NodeTypes.LiquidBranch);
          expectPath(ast, 'children.0.children.0.isLeadingWhitespaceSensitive').to.be.false;
          expectPath(ast, 'children.0.children.0.children.0.isLeadingWhitespaceSensitive').to.be
            .false;

          ast = toAugmentedAst(`{% if A %}hello{% else -%} ${node}{% endif %}`);
          expectPath(ast, 'children.0.children.1.type').to.eql(NodeTypes.LiquidBranch);
          expectPath(ast, 'children.0.children.1.isLeadingWhitespaceSensitive').to.be.true;
          expectPath(ast, 'children.0.children.1.children.0.isLeadingWhitespaceSensitive').to.be
            .false;

          ast = toAugmentedAst(`{% if A %} hello {%- else -%} ${node} {% endif %}`);
          expectPath(ast, 'children.0.children.1.type').to.eql(NodeTypes.LiquidBranch);
          expectPath(ast, 'children.0.children.1.isLeadingWhitespaceSensitive').to.be.false;
        }
      });
    });

    it('should return false if the previous node creates a block rendering context that makes the following whitespace irrelevant', () => {
      ast = toAugmentedAst('<p><div>hello</div> this</p>');
      expectPath(ast, 'children.0.children.1.isLeadingWhitespaceSensitive').to.be.false;
    });

    it('should return false if the node itself creates a block rendering context', () => {
      ast = toAugmentedAst('<p>this <div>hello</div></p>');
      expectPath(ast, 'children.0.children.1.isLeadingWhitespaceSensitive').to.be.false;
    });
  });

  function toAugmentedAst(code: string, options: Partial<LiquidParserOptions> = {}) {
    return preprocess(toLiquidHtmlAST(code), options as LiquidParserOptions);
  }

  function expectPath(ast: LiquidHtmlNode, path: string, message?: string) {
    return expect(deepGet(path.split('.'), ast), message);
  }
});
