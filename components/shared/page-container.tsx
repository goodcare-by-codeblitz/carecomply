import clsx from 'clsx';
import React from 'react';

const ContainerBox = ({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) => {
	return <div className={clsx('max-w-400', className)}>{children}</div>;
};

export default ContainerBox;
