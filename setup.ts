import addContext from 'mochawesome/addContext';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

let consoleLogs: string[] = [];

function captureConsoleLogs(consoleLogs: string[]) {
    consoleLogs = [];
    const originalConsoleLog = console.log;
    console.log = function (...args: any[]) {
        consoleLogs.push(args.join(' '));
        originalConsoleLog.apply(console, args);
    };
    return consoleLogs;
}

beforeEach(function () {
    console.log(`\n=== Before Each: ${this.currentTest?.title} ===\n`);
    consoleLogs = captureConsoleLogs(consoleLogs);
});

afterEach(function () {
    console.log(`\n=== After Each: ${this.currentTest?.title} ===\n`);
    if (consoleLogs.length > 0) {
        addContext(this, {
            title: 'Test Result',
            value: consoleLogs.join('\n'),
        });
        consoleLogs = [];
    }
});

console.log('Custom global hooks installed successfully!');
