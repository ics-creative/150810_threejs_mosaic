module.exports = {
  mode: "development",
  // メインとなるJavaScriptファイル（エントリーポイント）
  entry: {
    "DemoIcons_4000": './src/DemoIcons_4000.ts',
    "DemoCubes": './src/DemoCubes.ts',
    "DemoIcons": './src/DemoIcons.ts',
  },
  // ファイルの出力設定
  output: {
    //  出力ファイルのディレクトリ名
    path: `${__dirname}/docs`,
    // 出力ファイル名
    filename: '[name].js'
  },
  module: {
    rules: [{
        // 拡張子 .ts の場合
        test: /\.ts$/,
        // TypeScript をコンパイルする
        use: 'ts-loader'
      },
      // スタイルシートもバンドルする
      {
        test: /\.css/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              url: false
            }
          },
        ],
      },
      // 画像もバンドルする
      {
        // 対象となるファイルの拡張子
        test: /\.(gif|png|jpg)$/,
        // 画像をBase64として取り込む
        loader: 'url-loader'
      }
    ]
  },
  // import 文で .ts ファイルを解決するため
  resolve: {
    extensions: [
      '.ts', '.js'
    ],
  },
  // webpack-serve の設定
  devServer:  {
    open: true,
    contentBase: './docs'
  }
};
