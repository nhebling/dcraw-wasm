import Module from './bin/dcraw.js';

var thisProgram = './bin/dcraw.js';
class DcrawWasm {
	static run(args) {
		Module().then(function (dcrawModule) {
			args = args || [];

			var argc = args.length + 1;
			var argv = [dcrawModule.allocate(dcrawModule.intArrayFromString(thisProgram), dcrawModule.ALLOC_NORMAL), 0, 0, 0];
			for (var i = 0; i < argc - 1; i = i + 1) {
				argv = argv.concat([
					dcrawModule.allocate(dcrawModule.intArrayFromString(args[i]), dcrawModule.ALLOC_NORMAL),
					0,
					0,
					0,
				]);
			}
			argv.push(0);
			argv = dcrawModule.allocate(argv, dcrawModule.ALLOC_NORMAL);

			return dcrawModule['_main'](argc, argv, 0);
		});
	}
}

export { DcrawWasm };
