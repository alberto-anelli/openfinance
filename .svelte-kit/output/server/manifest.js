export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "finance/_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.CAese6SU.js",app:"_app/immutable/entry/app.mSGNq9ia.js",imports:["_app/immutable/entry/start.CAese6SU.js","_app/immutable/chunks/dqnBQYwU.js","_app/immutable/chunks/IwWt2fPd.js","_app/immutable/chunks/qxrUeG2a.js","_app/immutable/entry/app.mSGNq9ia.js","_app/immutable/chunks/IwWt2fPd.js","_app/immutable/chunks/DNDTFGjR.js","_app/immutable/chunks/j6gFgvoI.js","_app/immutable/chunks/qxrUeG2a.js","_app/immutable/chunks/yW7AgaLe.js","_app/immutable/chunks/Btos2W-O.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/add-entry",
				pattern: /^\/add-entry\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/add-notes",
				pattern: /^\/add-notes\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/month",
				pattern: /^\/month\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
