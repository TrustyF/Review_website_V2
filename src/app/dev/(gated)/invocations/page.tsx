import { InvocationCounter } from "./invocation-counter";
import styles from "./invocations-dev.module.sass";

export default function InvocationsDevPage() {
	return (
		<div className={styles.page}>
			<h1 className={styles.title}>Function invocations</h1>
			<p className={styles.description}>
				Process-local counter — tracks calls to instrumented server actions
				and routes (see recordInvocation calls) since this dev server
				started, or since the last Reset. Only meaningful in `next dev`; a
				real deployment spreads invocations across many isolated instances.
			</p>
			<InvocationCounter />
		</div>
	);
}
