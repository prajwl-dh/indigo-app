import React from 'react'
import { Accent } from 'src/shared/model/accent'
import { accentValue } from 'src/shared/model/accentValues'

type InitialLandingType = {
    activeAccent: Accent
}

export default function InitialLanding({ activeAccent }: InitialLandingType): React.JSX.Element {
    return <div className={`${accentValue[activeAccent].bg}`}>InitialLanding</div>
}
